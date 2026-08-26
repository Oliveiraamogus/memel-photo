import {
  DeleteObjectsCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { config } from "@/lib/config";

const credentials = {
  accessKeyId: config.s3.accessKeyId,
  secretAccessKey: config.s3.secretAccessKey,
};

/**
 * Two clients, because a presigned URL is only valid for the host it was signed
 * against. Anything a browser will fetch has to be signed with the public
 * endpoint; anything the server fetches itself goes over the internal one and
 * never leaves the Docker network.
 */
const publicClient = new S3Client({
  region: config.s3.region,
  endpoint: config.s3.endpointPublic,
  credentials,
  forcePathStyle: true,
});

const internalClient = new S3Client({
  region: config.s3.region,
  endpoint: config.s3.endpointInternal,
  credentials,
  forcePathStyle: true,
});

export const s3 = internalClient;

export const BUCKET_ORIGINALS = config.s3.bucketOriginals;
export const BUCKET_DERIVED = config.s3.bucketDerived;

export function originalKey(photoId: string, extension: string): string {
  const ext = extension.replace(/^\./, "").toLowerCase() || "bin";
  return `originals/${photoId}.${ext}`;
}

export function derivedKey(photoId: string, width: number, format: string): string {
  return `derived/${photoId}/${width}.${format}`;
}

/** A URL the browser can PUT the original straight to, skipping our Node process. */
export function presignUpload(key: string, contentType: string, ttlSeconds?: number) {
  return getSignedUrl(
    publicClient,
    new PutObjectCommand({
      Bucket: BUCKET_ORIGINALS,
      Key: key,
      ContentType: contentType,
    }),
    { expiresIn: ttlSeconds ?? config.s3.presignTtlSeconds },
  );
}

/** A URL the browser can GET an image from. Callers must have run the ACL first. */
export function presignDownload(
  bucket: string,
  key: string,
  options: { ttlSeconds?: number; filename?: string } = {},
) {
  return getSignedUrl(
    publicClient,
    new GetObjectCommand({
      Bucket: bucket,
      Key: key,
      ...(options.filename
        ? {
            ResponseContentDisposition: `attachment; filename="${options.filename.replace(/"/g, "")}"`,
          }
        : {}),
    }),
    { expiresIn: options.ttlSeconds ?? config.s3.presignTtlSeconds },
  );
}

export async function getObjectBuffer(bucket: string, key: string): Promise<Buffer> {
  const response = await internalClient.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  const body = response.Body;
  if (!body) throw new Error(`Empty body for ${bucket}/${key}`);
  return Buffer.from(await body.transformToByteArray());
}

export async function putObject(
  bucket: string,
  key: string,
  body: Buffer,
  contentType: string,
) {
  await internalClient.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

export async function deleteObjects(bucket: string, keys: string[]) {
  if (keys.length === 0) return;
  // DeleteObjects caps at 1000 keys per call.
  for (let i = 0; i < keys.length; i += 1000) {
    const chunk = keys.slice(i, i + 1000);
    await internalClient.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: { Objects: chunk.map((Key) => ({ Key })) },
      }),
    );
  }
}
