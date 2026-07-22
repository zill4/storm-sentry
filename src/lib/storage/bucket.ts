import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"

// Railway object storage (S3-compatible, virtual-host URL style). Holds
// customer logo uploads and generated tarp designs. Keys are namespaced
// `requests/<requestId>/…` so a request's assets live together.

declare global {
  var __stormSentryS3: S3Client | undefined
}

export function isBucketConfigured(): boolean {
  return Boolean(
    process.env.BUCKET_ENDPOINT &&
      process.env.BUCKET_NAME &&
      process.env.BUCKET_ACCESS_KEY_ID &&
      process.env.BUCKET_SECRET_ACCESS_KEY,
  )
}

function client(): S3Client {
  if (!globalThis.__stormSentryS3) {
    if (!isBucketConfigured()) {
      throw new Error("bucket env vars are required (BUCKET_ENDPOINT/NAME/ACCESS_KEY_ID/SECRET_ACCESS_KEY)")
    }
    globalThis.__stormSentryS3 = new S3Client({
      endpoint: process.env.BUCKET_ENDPOINT,
      region: process.env.BUCKET_REGION ?? "auto",
      credentials: {
        accessKeyId: process.env.BUCKET_ACCESS_KEY_ID!,
        secretAccessKey: process.env.BUCKET_SECRET_ACCESS_KEY!,
      },
    })
  }
  return globalThis.__stormSentryS3
}

const bucket = () => process.env.BUCKET_NAME!

export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await client().send(
    new PutObjectCommand({ Bucket: bucket(), Key: key, Body: body, ContentType: contentType }),
  )
}

export async function getObject(
  key: string,
): Promise<{ body: ReadableStream; contentType: string | null; contentLength: number | null } | null> {
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
    return {
      body: res.Body!.transformToWebStream() as ReadableStream,
      contentType: res.ContentType ?? null,
      contentLength: res.ContentLength ?? null,
    }
  } catch (err) {
    if ((err as { name?: string }).name === "NoSuchKey") return null
    throw err
  }
}

export async function getObjectBuffer(key: string): Promise<Buffer | null> {
  try {
    const res = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }))
    return Buffer.from(await res.Body!.transformToByteArray())
  } catch (err) {
    if ((err as { name?: string }).name === "NoSuchKey") return null
    throw err
  }
}

export async function deleteObject(key: string): Promise<void> {
  await client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }))
}
