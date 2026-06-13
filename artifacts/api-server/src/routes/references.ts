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
  return {
    ...ref,
    createdAt: ref.createdAt.toISOString(),
    updatedAt: ref.updatedAt.toISOString(),
  };
}

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
