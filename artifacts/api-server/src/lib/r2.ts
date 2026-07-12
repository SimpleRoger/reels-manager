import { S3Client, PutObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";

const accountId = process.env.R2_ACCOUNT_ID;
const bucket = process.env.R2_BUCKET ?? "reel-journal-videos";
const publicUrl = process.env.R2_PUBLIC_URL?.replace(/\/+$/, "");

let _client: S3Client | null = null;

function getClient(): S3Client {
  if (_client) return _client;
  if (!accountId || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 env vars not configured");
  }
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  return _client;
}

export function r2PublicUrl(key: string): string {
  if (!publicUrl) throw new Error("R2_PUBLIC_URL not configured");
  return `${publicUrl}/${key}`;
}

export function isR2Url(url: string): boolean {
  return !!publicUrl && url.startsWith(publicUrl);
}

/** Returns true if the object already exists in R2 (avoids re-uploading). */
export async function r2Exists(key: string): Promise<boolean> {
  try {
    await getClient().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** Downloads a URL and uploads it to R2. Returns the public URL. */
export async function uploadToR2(key: string, sourceUrl: string, contentType = "video/mp4"): Promise<string> {
  const resp = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      "Referer": "https://www.instagram.com/",
    },
  });
  if (!resp.ok || !resp.body) throw new Error(`Failed to fetch source: ${resp.status}`);

  const ct = resp.headers.get("content-type")?.split(";")[0] ?? contentType;
  const buffer = Buffer.from(await resp.arrayBuffer());

  await getClient().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: ct,
    CacheControl: "public, max-age=31536000, immutable",
  }));

  return r2PublicUrl(key);
}

/** Upload raw bytes to R2. Returns the public URL. */
export async function uploadBytesToR2(key: string, buffer: Buffer, contentType: string): Promise<string> {
  await getClient().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: buffer,
    ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable",
  }));
  return r2PublicUrl(key);
}
