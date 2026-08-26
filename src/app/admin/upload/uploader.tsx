"use client";

import { useCallback, useRef, useState } from "react";

type Status = "queued" | "uploading" | "processing" | "done" | "error";

type Item = {
  id: string;
  file: File;
  progress: number;
  status: Status;
  error?: string;
};

const MAX_CONCURRENT = 3;

/** fetch gives no upload progress, so the PUT goes through XHR. */
function putWithProgress(url: string, file: File, onProgress: (pct: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.upload.addEventListener("progress", (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`Storage rejected the upload (${xhr.status})`));
    });
    xhr.addEventListener("error", () =>
      reject(new Error("Network error reaching storage. Check S3_ENDPOINT_PUBLIC.")),
    );
    xhr.send(file);
  });
}

export function Uploader({ tags }: { tags: { id: string; name: string }[] }) {
  const [items, setItems] = useState<Item[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const tagsRef = useRef<string[]>([]);
  tagsRef.current = selectedTags;

  const update = useCallback((id: string, patch: Partial<Item>) => {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
  }, []);

  const uploadOne = useCallback(
    async (item: Item) => {
      try {
        update(item.id, { status: "uploading", progress: 0 });

        const presignResponse = await fetch("/api/uploads/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            filename: item.file.name,
            contentType: item.file.type || "image/jpeg",
            bytes: item.file.size,
          }),
        });
        if (!presignResponse.ok) throw new Error(await readError(presignResponse));
        const { photoId, key, url } = await presignResponse.json();

        await putWithProgress(url, item.file, (pct) => update(item.id, { progress: pct }));

        update(item.id, { status: "processing", progress: 100 });

        const completeResponse = await fetch("/api/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            photoId,
            key,
            filename: item.file.name,
            contentType: item.file.type || "image/jpeg",
            bytes: item.file.size,
            tagIds: tagsRef.current,
          }),
        });
        if (!completeResponse.ok) throw new Error(await readError(completeResponse));

        update(item.id, { status: "done" });
      } catch (error) {
        update(item.id, {
          status: "error",
          error: error instanceof Error ? error.message : "Upload failed",
        });
      }
    },
    [update],
  );

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const incoming: Item[] = Array.from(files)
        .filter((file) => file.type.startsWith("image/"))
        .map((file) => ({
          id: `${file.name}-${file.size}-${crypto.randomUUID()}`,
          file,
          progress: 0,
          status: "queued" as Status,
        }));

      if (incoming.length === 0) return;
      setItems((current) => [...current, ...incoming]);

      // A small pool keeps a 200-photo drop from opening 200 sockets at once.
      const queue = [...incoming];
      const workers = Array.from({ length: Math.min(MAX_CONCURRENT, queue.length) }, async () => {
        while (queue.length > 0) {
          const next = queue.shift();
          if (next) await uploadOne(next);
        }
      });
      await Promise.all(workers);
    },
    [uploadOne],
  );

  const pending = items.filter((i) => i.status !== "done" && i.status !== "error").length;
  const failed = items.filter((i) => i.status === "error");

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void addFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`panel flex cursor-pointer flex-col items-center justify-center gap-2 border-dashed px-6 py-16 text-center transition-colors ${
          dragging ? "border-[var(--color-accent)] bg-[#1c1a16]" : ""
        }`}
      >
        <p className="text-base">Drop photos here</p>
        <p className="text-sm text-[var(--color-muted)]">
          or click to choose files. They upload straight to storage, not through the site.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void addFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {tags.length > 0 && (
        <div className="mt-6">
          <span className="label">Tag everything in this batch</span>
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => {
              const active = selectedTags.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  type="button"
                  className={`btn ${active ? "btn-primary" : ""}`}
                  onClick={() =>
                    setSelectedTags((current) =>
                      active ? current.filter((id) => id !== tag.id) : [...current, tag.id],
                    )
                  }
                >
                  {tag.name}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-[var(--color-muted)]">
            Tags apply to files added after selecting them. A tag can put a photo into a
            public rule album, so check the album list before tagging a private batch.
          </p>
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span>
              {items.length} file{items.length === 1 ? "" : "s"}
              {pending > 0 ? ` — ${pending} in flight` : " — all finished"}
            </span>
            <button
              type="button"
              className="btn"
              onClick={() => setItems((c) => c.filter((i) => i.status !== "done"))}
            >
              Clear finished
            </button>
          </div>

          <ul className="panel divide-y divide-[var(--color-line)]">
            {items.map((item) => (
              <li key={item.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                <span className="min-w-0 flex-1 truncate">{item.file.name}</span>
                <span className="w-40">
                  <span className="block h-1 w-full rounded bg-[#26262c]">
                    <span
                      className={`block h-1 rounded transition-all ${
                        item.status === "error" ? "bg-red-500" : "bg-[var(--color-accent)]"
                      }`}
                      style={{ width: `${item.progress}%` }}
                    />
                  </span>
                </span>
                <span
                  className={`w-28 text-right text-xs ${
                    item.status === "error"
                      ? "text-red-400"
                      : item.status === "done"
                        ? "text-green-400"
                        : "text-[var(--color-muted)]"
                  }`}
                >
                  {item.status === "processing" ? "deriving" : item.status}
                </span>
              </li>
            ))}
          </ul>

          {failed.length > 0 && (
            <div className="mt-4 rounded border border-red-900 bg-red-950/30 px-4 py-3 text-sm text-red-300">
              {failed.map((item) => (
                <p key={item.id}>
                  {item.file.name}: {item.error}
                </p>
              ))}
            </div>
          )}

          <p className="mt-4 text-xs text-[var(--color-muted)]">
            &quot;deriving&quot; means the worker is generating sizes and reading EXIF. Photos
            file themselves into their dated album once the capture date is known.
          </p>
        </div>
      )}
    </div>
  );
}

async function readError(response: Response) {
  try {
    const body = await response.json();
    return body.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}
