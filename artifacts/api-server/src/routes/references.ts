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

// Proxy a Cobalt request server-side to get a playable video URL for any
// public Instagram or TikTok reel. Set COBALT_API_URL env var to your
// self-hosted instance (e.g. https://cobalt.up.railway.app).
router.get("/references/video-url", async (req, res): Promise<void> => {
  const url = req.query["url"];
  if (typeof url !== "string") {
    res.status(400).json({ error: "url required" });
    return;
  }

  // YTDLP_API_URL → tubedl service (yt-dlp based, works for IG + TikTok)
  // COBALT_API_URL → Cobalt service (fallback)
  const ytdlpBase = process.env.YTDLP_API_URL?.replace(/\/+$/, "");
  const cobaltBase = process.env.COBALT_API_URL?.replace(/\/+$/, "");

  if (!ytdlpBase && !cobaltBase) {
    res.status(503).json({ error: "No video URL service configured (set YTDLP_API_URL or COBALT_API_URL)" });
    return;
  }

  // Try yt-dlp first
  if (ytdlpBase) {
    const ytResp = await fetch(`${ytdlpBase}/api/video-url?url=${encodeURIComponent(url)}`).catch(() => null);
    if (ytResp?.ok) {
      const d = await ytResp.json() as { videoUrl?: string };
      if (d.videoUrl) { res.json({ videoUrl: d.videoUrl }); return; }
    }
  }

  // Fall back to Cobalt
  if (cobaltBase) {
    const cobaltResp = await fetch(cobaltBase, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Accept": "application/json" },
      body: JSON.stringify({ url }),
    }).catch(() => null);

    if (cobaltResp?.ok) {
      const data = await cobaltResp.json() as { status: string; url?: string; error?: { code: string } };
      if (data.url && data.status !== "error") { res.json({ videoUrl: data.url }); return; }
    }
  }

  res.status(404).json({ error: "Could not retrieve video URL" });
});

// Re-run Apify on ALL saved references to refresh expired CDN URLs
router.post("/references/refresh-all", async (req, res): Promise<void> => {
  const refs = await db.select({ id: savedReferencesTable.id, url: savedReferencesTable.url }).from(savedReferencesTable);
  // Fire all in background — respond immediately
  (async () => {
    for (const ref of refs) {
      await enrichReferenceWithApify(ref.id, ref.url).catch(() => {});
    }
  })();
  res.json({ queued: refs.length });
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
