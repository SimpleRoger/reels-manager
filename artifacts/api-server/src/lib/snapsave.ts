import { db, savedReferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { uploadToR2 } from "./r2";

export interface SnapsaveResult {
  videoUrl: string | null;
  thumbDataUrl: string | null;
  videoCdnUrl: string | null;
}

export async function getSnapsaveMedia(sourceUrl: string): Promise<SnapsaveResult> {
  const resp = await fetch("https://snapsave.app/action.php?lang=en", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Origin": "https://snapsave.app",
      "Referer": "https://snapsave.app/",
    },
    body: `url=${encodeURIComponent(sourceUrl)}`,
  }).catch(() => null);

  if (!resp?.ok) return { videoUrl: null, thumbDataUrl: null, videoCdnUrl: null };

  const obfJs = await resp.text().catch(() => null);
  if (!obfJs) return { videoUrl: null, thumbDataUrl: null, videoCdnUrl: null };

  try {
    const parts = obfJs.split("eval(");
    if (parts.length < 2) return { videoUrl: null, thumbDataUrl: null, videoCdnUrl: null };

    const helpers = parts[0];
    const inner = parts.slice(1).join("eval(");
    // eslint-disable-next-line no-eval
    const html: unknown = eval(`${helpers}; (${inner.slice(0, -1)})`);
    if (typeof html !== "string") return { videoUrl: null, thumbDataUrl: null, videoCdnUrl: null };

    function decodeJwtUrl(rapidUrl: string): string | null {
      try {
        const token = new URL(rapidUrl).searchParams.get("token");
        if (!token) return null;
        const payload = JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());
        return typeof payload?.url === "string" && payload.url.startsWith("http") ? payload.url : null;
      } catch { return null; }
    }

    const videoMatches = [...html.matchAll(/(https?:\/\/d\.rapidcdn\.app\/v2\?token=[^\s"'<>\\]+)/g)];
    const videoCdnUrl = videoMatches[0]?.[1] ? decodeJwtUrl(videoMatches[0][1]) : null;

    const thumbMatches = [...html.matchAll(/(https?:\/\/d\.rapidcdn\.app\/thumb\?token=[^\s"'<>\\]+)/g)];
    const thumbCdnUrl = thumbMatches[0]?.[1] ? decodeJwtUrl(thumbMatches[0][1]) : null;

    const videoUrl = videoCdnUrl ? `/api/references/proxy-video?url=${encodeURIComponent(videoCdnUrl)}` : null;

    let thumbDataUrl: string | null = null;
    if (thumbCdnUrl) {
      try {
        const imgResp = await fetch(thumbCdnUrl, {
          headers: { "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15" },
        });
        if (imgResp.ok) {
          const buf = Buffer.from(await imgResp.arrayBuffer());
          const mime = imgResp.headers.get("content-type")?.split(";")[0] ?? "image/jpeg";
          thumbDataUrl = `data:${mime};base64,${buf.toString("base64")}`;
        }
      } catch { /* skip */ }
    }

    return { videoUrl, thumbDataUrl, videoCdnUrl };
  } catch {
    return { videoUrl: null, thumbDataUrl: null, videoCdnUrl: null };
  }
}

export function uploadToR2Background(referenceId: number, sourceUrl: string, videoCdnUrl: string, thumbDataUrl: string | null) {
  (async () => {
    try {
      const key = `videos/${Buffer.from(sourceUrl).toString("base64url").slice(0, 64)}.mp4`;
      const r2Url = await uploadToR2(key, videoCdnUrl);
      const updates: Record<string, string> = { mediaUrl: r2Url };
      if (thumbDataUrl) updates.thumbnailUrl = thumbDataUrl;
      await db.update(savedReferencesTable).set(updates).where(eq(savedReferencesTable.id, referenceId));
    } catch (err) {
      console.error(`[R2] Upload failed for reference ${referenceId}:`, err);
    }
  })();
}
