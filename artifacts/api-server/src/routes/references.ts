import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, savedReferencesTable } from "@workspace/db";
import {
  CreateReferenceBody,
  UpdateReferenceParams,
  UpdateReferenceBody,
  DeleteReferenceParams,
} from "@workspace/api-zod";
import { resolveReelMedia, enrichReferenceWithApify } from "../lib/resolve-reel-video";
import { uploadToR2, uploadBytesToR2, r2Exists, isR2Url } from "../lib/r2";

const router: IRouter = Router();

function formatReference(ref: typeof savedReferencesTable.$inferSelect) {
  // Replace stored data URLs with a proper image endpoint URL so the client
  // never has to embed a 48KB base64 string in a JSON response or img src attr.
  const thumb = ref.thumbnailUrl?.startsWith("data:")
    ? `/api/references/${ref.id}/thumbnail`
    : ref.thumbnailUrl;
  return {
    ...ref,
    thumbnailUrl: thumb ?? null,
    createdAt: ref.createdAt.toISOString(),
    updatedAt: ref.updatedAt.toISOString(),
  };
}

// GET /api/references/:id/thumbnail — serves the stored image bytes for this reference.
// If the DB has a data URL it streams the decoded bytes; otherwise it proxies the CDN URL.
router.get("/references/:id/thumbnail", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).end(); return; }

  const [ref] = await db
    .select({ thumbnailUrl: savedReferencesTable.thumbnailUrl })
    .from(savedReferencesTable)
    .where(eq(savedReferencesTable.id, id))
    .limit(1);

  if (!ref?.thumbnailUrl) { res.status(404).end(); return; }

  if (ref.thumbnailUrl.startsWith("data:")) {
    const [meta, b64] = ref.thumbnailUrl.split(",", 2);
    const mime = meta.replace("data:", "").replace(";base64", "");
    const buf = Buffer.from(b64, "base64");
    res.set("Content-Type", mime);
    res.set("Cache-Control", "public, max-age=31536000, immutable");
    res.send(buf);
    return;
  }

  // Fall back: redirect to CDN (may expire, but that's the best we have)
  res.redirect(302, ref.thumbnailUrl);
});

router.get("/references", async (_req, res): Promise<void> => {
  const refs = await db
    .select()
    .from(savedReferencesTable)
    .orderBy(desc(savedReferencesTable.commentsCount));
  res.json({ references: refs.map(formatReference) });
});

router.post("/references", async (req, res): Promise<void> => {
  const body = CreateReferenceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  // Check if this is one of the user's own reels (fast path — no Apify needed)
  const resolved = await resolveReelMedia(body.data.url);

  const [ref] = await db.insert(savedReferencesTable).values({
    ...body.data,
    mediaUrl: body.data.mediaUrl ?? resolved.mediaUrl,
    thumbnailUrl: body.data.thumbnailUrl ?? resolved.thumbnailUrl,
  }).returning();

  // Fire Apify enrichment in the background (doesn't block the response)
  if (!resolved.mediaUrl) {
    enrichReferenceWithApify(ref.id, body.data.url).catch(() => {});
  }

  res.status(201).json(formatReference(ref));
});

router.patch("/references/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateReferenceParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateReferenceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [ref] = await db
    .update(savedReferencesTable)
    .set(body.data)
    .where(eq(savedReferencesTable.id, params.data.id))
    .returning();

  if (!ref) {
    res.status(404).json({ error: "Reference not found" });
    return;
  }

  res.json(formatReference(ref));
});

// Bulk import from Replit — accepts the old snake_case JSON format, skips dupes by URL
router.post("/references/bulk-import", async (req, res): Promise<void> => {
  const entries = req.body;
  if (!Array.isArray(entries)) {
    res.status(400).json({ error: "Expected an array of reference objects" });
    return;
  }

  // Load existing URLs to skip duplicates
  const existing = await db
    .select({ url: savedReferencesTable.url })
    .from(savedReferencesTable);
  const existingUrls = new Set(existing.map((r) => r.url));

  let inserted = 0;
  let skipped = 0;

  for (const e of entries) {
    if (!e.url) { skipped++; continue; }
    if (existingUrls.has(e.url)) { skipped++; continue; }

    const thumb = typeof e.thumbnail_url === "string" && !e.thumbnail_url.startsWith("data:")
      ? e.thumbnail_url
      : null;

    await db.insert(savedReferencesTable).values({
      url:           e.url,
      caption:       e.caption ?? null,
      accountName:   e.account_name ?? null,
      whyItsgood:    e.why_its_good ?? null,
      whatToChange:  e.what_to_change ?? null,
      howToRemake:   e.how_to_remake ?? null,
      commentsCount: typeof e.comments_count === "number" ? e.comments_count : null,
      likeCount:     typeof e.like_count === "number" ? e.like_count : null,
      viewCount:     typeof e.view_count === "number" ? e.view_count : null,
      mediaUrl:      e.media_url ?? null,
      thumbnailUrl:  thumb,
      tags:          Array.isArray(e.tags) ? e.tags : [],
    });

    existingUrls.add(e.url);
    inserted++;
  }

  res.json({ inserted, skipped, message: `Imported ${inserted} references, skipped ${skipped} (duplicates or missing URL)` });
});

// External ingest — lets other apps POST a reel URL into the remake list
// Optional auth: set INGEST_API_KEY env var; callers send "Authorization: Bearer <key>"
router.post("/references/ingest", async (req, res): Promise<void> => {
  const requiredKey = process.env.INGEST_API_KEY;
  if (requiredKey) {
    const auth = req.headers["authorization"] ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    if (token !== requiredKey) {
      res.status(401).json({ error: "Invalid or missing API key" });
      return;
    }
  }

  const url = typeof req.body?.url === "string" ? req.body.url.trim() : null;
  if (!url) {
    res.status(400).json({ error: "url is required" });
    return;
  }

  // Skip duplicate URLs
  const existing = await db
    .select({ id: savedReferencesTable.id })
    .from(savedReferencesTable)
    .where(eq(savedReferencesTable.url, url));
  if (existing.length) {
    res.status(200).json({ duplicate: true, id: existing[0].id });
    return;
  }

  const resolved = await resolveReelMedia(url);
  const [ref] = await db
    .insert(savedReferencesTable)
    .values({ url, mediaUrl: resolved.mediaUrl, thumbnailUrl: resolved.thumbnailUrl })
    .returning();

  if (!resolved.mediaUrl) {
    enrichReferenceWithApify(ref.id, url).catch(() => {});
  }

  res.status(201).json(formatReference(ref));
});

// Scrape snapsave.app to get direct video + thumbnail URLs for any public IG/TikTok reel.
// Returns a proxy videoUrl immediately (fast) plus the raw CDN URL for background R2 upload.
async function getSnapsaveMedia(sourceUrl: string): Promise<{ videoUrl: string | null; thumbDataUrl: string | null; videoCdnUrl: string | null }> {
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
    // Response is: [helper fns] eval(deobfuscator_call)
    // Splitting on 'eval(' lets us run only the pure deobfuscation step (no DOM APIs needed).
    // The deobfuscator returns an HTML string containing download links.
    const parts = obfJs.split("eval(");
    if (parts.length < 2) return { videoUrl: null, thumbDataUrl: null, videoCdnUrl: null };

    const helpers = parts[0];
    const inner = parts.slice(1).join("eval("); // 'func(args))' — trailing ) closes outer eval
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

    // Video: d.rapidcdn.app/v2
    const videoMatches = [...html.matchAll(/(https?:\/\/d\.rapidcdn\.app\/v2\?token=[^\s"'<>\\]+)/g)];
    const videoCdnUrl = videoMatches[0]?.[1] ? decodeJwtUrl(videoMatches[0][1]) : null;

    // Thumbnail: d.rapidcdn.app/thumb
    const thumbMatches = [...html.matchAll(/(https?:\/\/d\.rapidcdn\.app\/thumb\?token=[^\s"'<>\\]+)/g)];
    const thumbCdnUrl = thumbMatches[0]?.[1] ? decodeJwtUrl(thumbMatches[0][1]) : null;

    // Return proxy URL immediately so the browser can start playing right away.
    // R2 upload happens in the background — next play will use the saved R2 URL.
    const videoUrl = videoCdnUrl ? `/api/references/proxy-video?url=${encodeURIComponent(videoCdnUrl)}` : null;

    // Store the raw CDN URL so the caller can kick off a background R2 upload
    const videoCdnUrlOut = videoCdnUrl;

    // Download thumbnail synchronously (small ~50KB, worth waiting for)
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
      } catch { /* skip thumbnail */ }
    }

    return { videoUrl, thumbDataUrl, videoCdnUrl: videoCdnUrlOut };
  } catch {
    return { videoUrl: null, thumbDataUrl: null, videoCdnUrl: null };
  }
}

async function getSnapsaveVideoUrl(sourceUrl: string): Promise<string | null> {
  const { videoUrl } = await getSnapsaveMedia(sourceUrl);
  return videoUrl;
}

// Upload a video CDN URL to R2 in the background and update the DB record.
function uploadToR2Background(referenceId: number, sourceUrl: string, videoCdnUrl: string, thumbDataUrl: string | null) {
  (async () => {
    try {
      const key = `videos/${Buffer.from(sourceUrl).toString("base64url").slice(0, 64)}.mp4`;
      const r2Url = await uploadToR2(key, videoCdnUrl);
      const updates: Record<string, string> = { mediaUrl: r2Url };
      if (thumbDataUrl) updates.thumbnailUrl = thumbDataUrl;
      await db.update(savedReferencesTable).set(updates).where(eq(savedReferencesTable.id, referenceId));
      console.log(`[R2] Saved ${r2Url} for reference ${referenceId}`);
    } catch (err) {
      console.error(`[R2] Upload failed for reference ${referenceId}:`, err);
    }
  })();
}

// Proxy an Instagram CDN video through the server to avoid browser CORS restrictions.
// Forwards Range headers so the browser can seek (required for <video> to play).
router.get("/references/proxy-video", async (req, res): Promise<void> => {
  const url = req.query["url"];
  if (typeof url !== "string" || !url.startsWith("http")) {
    res.status(400).end(); return;
  }

  const upstreamHeaders: Record<string, string> = {
    "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
    "Referer": "https://www.instagram.com/",
  };
  const rangeHeader = req.headers["range"];
  if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

  const upstream = await fetch(url, { headers: upstreamHeaders }).catch(() => null);

  if (!upstream || (!upstream.ok && upstream.status !== 206) || !upstream.body) {
    res.status(502).end(); return;
  }

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.setHeader("Accept-Ranges", "bytes");
  res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "video/mp4");

  const contentLength = upstream.headers.get("content-length");
  if (contentLength) res.setHeader("Content-Length", contentLength);

  const contentRange = upstream.headers.get("content-range");
  if (contentRange) res.setHeader("Content-Range", contentRange);

  res.status(upstream.status === 206 ? 206 : 200);

  const { Readable } = await import("stream");
  Readable.fromWeb(upstream.body as import("stream/web").ReadableStream).pipe(res);
});

// Returns a playable video URL for any public Instagram or TikTok reel.
// Instagram: snapsave → proxy (Cobalt needs cookies and its tunnel URLs expire in seconds)
// TikTok: yt-dlp → Cobalt → snapsave
router.get("/references/video-url", async (req, res): Promise<void> => {
  const url = req.query["url"];
  if (typeof url !== "string") {
    res.status(400).json({ error: "url required" });
    return;
  }

  const isInstagram = url.includes("instagram.com");
  const ytdlpBase = process.env.YTDLP_API_URL?.replace(/\/+$/, "");
  const cobaltBase = process.env.COBALT_API_URL?.replace(/\/+$/, "");

  // snapsave first — returns proxy URL immediately, uploads to R2 in background
  const { videoUrl: snapsaveUrl, thumbDataUrl, videoCdnUrl } = await getSnapsaveMedia(url);
  if (snapsaveUrl) {
    const refId = typeof req.query["referenceId"] === "string" ? parseInt(req.query["referenceId"], 10) : null;
    if (refId && !isNaN(refId)) {
      // Save proxy URL + thumbnail to DB immediately so next page load skips snapsave
      const immediateUpdate: Record<string, string> = { mediaUrl: snapsaveUrl };
      if (thumbDataUrl) immediateUpdate.thumbnailUrl = thumbDataUrl;
      db.update(savedReferencesTable).set(immediateUpdate).where(eq(savedReferencesTable.id, refId)).catch(() => {});
      // Then upgrade to permanent R2 URL in background
      if (videoCdnUrl) uploadToR2Background(refId, url, videoCdnUrl, thumbDataUrl);
    }
    res.json({ videoUrl: snapsaveUrl, thumbnailUrl: thumbDataUrl }); return;
  }

  // yt-dlp fallback — wrap raw CDN URLs in our proxy to avoid 403s in the browser
  if (ytdlpBase) {
    const ytResp = await fetch(`${ytdlpBase}/api/video-url?url=${encodeURIComponent(url)}`).catch(() => null);
    if (ytResp?.ok) {
      const d = await ytResp.json() as { videoUrl?: string };
      if (d.videoUrl) {
        const proxied = `/api/references/proxy-video?url=${encodeURIComponent(d.videoUrl)}`;
        res.json({ videoUrl: proxied }); return;
      }
    }
  }

  // Cobalt as last resort (skip for Instagram — tunnel URLs expire too fast)
  if (cobaltBase && !isInstagram) {
    const cobaltResp = await fetch(cobaltBase, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => null);

    if (cobaltResp?.ok) {
      const data = await cobaltResp.json() as { status: string; url?: string; error?: { code: string } };
      if (data.url && data.status !== "error") {
        const proxied = `/api/references/proxy-video?url=${encodeURIComponent(data.url)}`;
        res.json({ videoUrl: proxied }); return;
      }
    }
  }

  res.status(404).json({ error: "Could not retrieve video URL" });
});

// Refresh thumbnail (and video if not yet on R2) via snapsave — updates DB.
router.post("/references/:id/refresh-thumbnail", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).end(); return; }

  const [ref] = await db
    .select({ url: savedReferencesTable.url, mediaUrl: savedReferencesTable.mediaUrl })
    .from(savedReferencesTable)
    .where(eq(savedReferencesTable.id, id))
    .limit(1);

  if (!ref) { res.status(404).end(); return; }

  const { videoUrl, thumbDataUrl, videoCdnUrl } = await getSnapsaveMedia(ref.url);
  if (!thumbDataUrl && !videoUrl) { res.status(502).json({ error: "Could not fetch media" }); return; }

  // Save thumbnail immediately; R2 video upload happens in background
  if (thumbDataUrl) {
    await db.update(savedReferencesTable).set({ thumbnailUrl: thumbDataUrl }).where(eq(savedReferencesTable.id, id));
  }
  if (videoCdnUrl && !ref.mediaUrl?.includes("r2.dev")) {
    uploadToR2Background(id, ref.url, videoCdnUrl, thumbDataUrl);
  }

  res.json({ thumbnailUrl: thumbDataUrl, videoUrl });
});

// Fast thumbnail refresh for all references using snapsave (no Apify needed).
// Runs up to 5 concurrent snapsave requests; responds immediately and processes in background.
router.post("/references/refresh-all", async (req, res): Promise<void> => {
  const refs = await db
    .select({ id: savedReferencesTable.id, url: savedReferencesTable.url, thumbnailUrl: savedReferencesTable.thumbnailUrl })
    .from(savedReferencesTable);

  // Prioritise refs with no thumbnail or expired CDN URLs (not data: or r2.dev)
  const needsThumb = refs.filter(r =>
    !r.thumbnailUrl || (!r.thumbnailUrl.startsWith("data:") && !r.thumbnailUrl.includes("r2.dev"))
  );

  res.json({ queued: needsThumb.length, total: refs.length });

  // Process in background with concurrency of 5
  (async () => {
    const CONCURRENCY = 5;
    for (let i = 0; i < needsThumb.length; i += CONCURRENCY) {
      const batch = needsThumb.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map(async (ref) => {
        try {
          const { videoUrl, thumbDataUrl } = await getSnapsaveMedia(ref.url);
          if (!thumbDataUrl && !videoUrl) return;
          const updates: Record<string, string> = {};
          if (thumbDataUrl) updates.thumbnailUrl = thumbDataUrl;
          if (videoUrl && !videoUrl.startsWith("/api/")) updates.mediaUrl = videoUrl;
          await db.update(savedReferencesTable).set(updates).where(eq(savedReferencesTable.id, ref.id));
        } catch { /* skip on error */ }
      }));
    }
  })();
});

// GET /api/references/tiktok-embed?url=<tiktok_url>
// Resolves a TikTok URL (including short vt.tiktok.com links) to an embeddable iframe URL.
// Short URLs are followed server-side to extract the numeric video ID.
router.get("/references/tiktok-embed", async (req, res): Promise<void> => {
  const raw = req.query["url"];
  if (typeof raw !== "string" || !raw.includes("tiktok.com")) {
    res.status(400).json({ error: "TikTok URL required" });
    return;
  }

  try {
    // Follow redirects to reach the canonical URL which contains the video ID
    const resp = await fetch(raw, {
      method: "HEAD",
      redirect: "follow",
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      },
    });

    // resp.url is the final URL after redirects
    const finalUrl = resp.url ?? raw;
    const match = finalUrl.match(/\/video\/(\d+)/);
    if (!match) {
      res.status(404).json({ error: "Could not extract TikTok video ID" });
      return;
    }

    const videoId = match[1];
    res.json({ embedUrl: `https://www.tiktok.com/embed/v2/${videoId}` });
  } catch (err) {
    req.log.warn({ err, url: raw }, "Failed to resolve TikTok embed URL");
    res.status(502).json({ error: "Failed to resolve TikTok URL" });
  }
});

router.delete("/references/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteReferenceParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(savedReferencesTable).where(eq(savedReferencesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
