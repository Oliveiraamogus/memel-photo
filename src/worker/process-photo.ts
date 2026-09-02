import exifr from "exifr";
import sharp from "sharp";
import { rgbaToThumbHash } from "thumbhash";
import { eq } from "drizzle-orm";
import { DERIVATIVE_WIDTHS, JPEG_FALLBACK_WIDTH, config } from "@/lib/config";
import { db } from "@/lib/db";
import { photo, photoVariant } from "@/lib/db/schema";
import { ensureDatedAlbum, recomputeForPhoto } from "@/lib/membership";
import {
  BUCKET_DERIVED,
  BUCKET_ORIGINALS,
  derivedKey,
  getObjectBuffer,
  putObject,
} from "@/lib/s3";

type Exif = {
  DateTimeOriginal?: Date;
  CreateDate?: Date;
  Make?: string;
  Model?: string;
  LensModel?: string;
  ISO?: number;
  FNumber?: number;
  ExposureTime?: number;
  FocalLength?: number;
  latitude?: number;
  longitude?: number;
};

/** "1/250" reads better than 0.004 next to a photo. */
function formatShutter(exposureTime?: number): string | null {
  if (!exposureTime) return null;
  if (exposureTime >= 1) return `${Number(exposureTime.toFixed(1))}s`;
  return `1/${Math.round(1 / exposureTime)}`;
}

function cameraName(exif: Exif): string | null {
  const make = exif.Make?.trim();
  const model = exif.Model?.trim();
  if (!make && !model) return null;
  if (model && make && model.toLowerCase().startsWith(make.toLowerCase())) return model;
  return [make, model].filter(Boolean).join(" ");
}

/**
 * A tiny blurred stand-in, stored as base64 and rendered while the real image
 * loads. Generated from a 100px thumbnail because thumbhash wants a small
 * input.
 */
async function makeThumbhash(input: Buffer): Promise<string | null> {
  try {
    const { data, info } = await sharp(input)
      .resize(100, 100, { fit: "inside" })
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const hash = rgbaToThumbHash(info.width, info.height, data);
    return Buffer.from(hash).toString("base64");
  } catch {
    return null;
  }
}

export async function processPhoto(photoId: string) {
  const [row] = await db.select().from(photo).where(eq(photo.id, photoId)).limit(1);
  if (!row) {
    console.warn(`[worker] photo ${photoId} vanished before processing`);
    return;
  }

  const original = await getObjectBuffer(BUCKET_ORIGINALS, row.originalKey);

  const image = sharp(original, { failOn: "none" });
  const metadata = await image.metadata();
  const width = metadata.width ?? null;
  const height = metadata.height ?? null;

  let exif: Exif = {};
  try {
    exif = (await exifr.parse(original, { gps: true })) ?? {};
  } catch {
    // A file without readable EXIF is still a perfectly good photo.
  }

  const takenAt = exif.DateTimeOriginal ?? exif.CreateDate ?? null;

  const variants: {
    width: number;
    height: number;
    format: string;
    key: string;
    bytes: number;
  }[] = [];

  for (const targetWidth of DERIVATIVE_WIDTHS) {
    // Never upscale: a 900px original should not produce a fake 2560px file.
    if (width && targetWidth > width && targetWidth !== DERIVATIVE_WIDTHS[0]) continue;

    const pipeline = sharp(original, { failOn: "none" })
      .rotate() // honour the EXIF orientation before it gets stripped
      .resize({ width: targetWidth, withoutEnlargement: true });

    const avif = await pipeline.clone().avif({ quality: 55, effort: 4 }).toBuffer({
      resolveWithObject: true,
    });
    const avifKey = derivedKey(photoId, targetWidth, "avif");
    await putObject(BUCKET_DERIVED, avifKey, avif.data, "image/avif");
    variants.push({
      width: avif.info.width,
      height: avif.info.height,
      format: "avif",
      key: avifKey,
      bytes: avif.data.length,
    });

    if (targetWidth === JPEG_FALLBACK_WIDTH) {
      const jpeg = await pipeline
        .clone()
        .jpeg({ quality: 82, progressive: true, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      const jpegKey = derivedKey(photoId, targetWidth, "jpg");
      await putObject(BUCKET_DERIVED, jpegKey, jpeg.data, "image/jpeg");
      variants.push({
        width: jpeg.info.width,
        height: jpeg.info.height,
        format: "jpg",
        key: jpegKey,
        bytes: jpeg.data.length,
      });
    }
  }

  // sharp drops all metadata unless asked to keep it, so derivatives carry no
  // GPS, no serial numbers and no owner name. Coordinates only ever reach the
  // database, and only when STORE_GPS is on.
  const thumbhash = await makeThumbhash(original);

  await db
    .update(photo)
    .set({
      width,
      height,
      takenAt,
      camera: cameraName(exif),
      lens: exif.LensModel?.trim() || null,
      iso: exif.ISO ?? null,
      aperture: exif.FNumber ?? null,
      shutter: formatShutter(exif.ExposureTime),
      exposureSeconds: exif.ExposureTime ?? null,
      focalLength: exif.FocalLength ?? null,
      gpsLatitude: config.storeGps ? (exif.latitude ?? null) : null,
      gpsLongitude: config.storeGps ? (exif.longitude ?? null) : null,
      thumbhash,
      status: "ready",
      updatedAt: new Date(),
    })
    .where(eq(photo.id, photoId));

  if (variants.length > 0) {
    await db
      .insert(photoVariant)
      .values(variants.map((v) => ({ photoId, ...v })))
      .onConflictDoNothing();
  }

  // Only now is the capture date known, which is what decides the dated album.
  if (takenAt) await ensureDatedAlbum(takenAt, db);

  await recomputeForPhoto(photoId, db);

  console.log(
    `[worker] processed ${row.filename} (${variants.length} variants${
      takenAt ? `, taken ${takenAt.toISOString().slice(0, 10)}` : ", no capture date"
    })`,
  );
}

export async function markPhotoFailed(photoId: string) {
  await db
    .update(photo)
    .set({ status: "failed", updatedAt: new Date() })
    .where(eq(photo.id, photoId));
}
