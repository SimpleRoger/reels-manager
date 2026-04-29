import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const APIFY_TOKEN = process.env["APIFY_API_TOKEN"];
const ACTOR_ID = "patient_discovery~instagram-search-reels";

interface SearchReelItem {
  id?: string;
  code?: string;
  // Caption — can be a string or an object with `.text`
  caption?: string | { text?: string; hashtags?: string[]; mentions?: string[] };
  user?: { username?: string; full_name?: string };
  ownerUsername?: string;
  // Engagement
  ig_play_count?: number;
  play_count?: number;
  like_count?: number;
  likesCount?: number;
  comment_count?: number;
  commentsCount?: number;
  share_count?: number;
  // Media
  video_url?: string;
  videoUrl?: string;
  // Thumbnail — actor doesn't always return one, try common fields
  thumbnail_url?: string;
  display_url?: string;
  thumbnailUrl?: string;
  displayUrl?: string;
  // Date
  taken_at_date?: string;
  timestamp?: string;
}

async function pollRun(runId: string): Promise<boolean> {
  const maxWait = 180_000;
  const interval = 4_000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, interval));
    const res = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    if (!res.ok) break;
    const data = (await res.json()) as { data: { status: string } };
    const status = data?.data?.status;
    if (status === "SUCCEEDED") return true;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      logger.warn({ runId, status }, "Apify search run did not succeed");
      return false;
    }
  }
  return false;
}

function extractCaption(raw: SearchReelItem["caption"]): string | null {
  if (!raw) return null;
  if (typeof raw === "string") return raw;
  return raw.text ?? null;
}

router.post("/reel-search", async (req, res): Promise<void> => {
  if (!APIFY_TOKEN) {
    res.status(503).json({ error: "Apify not configured" });
    return;
  }

  const raw = req.body?.hashtag as string | undefined;
  if (!raw?.trim()) {
    res.status(400).json({ error: "hashtag is required" });
    return;
  }

  // Strip leading # — the actor takes a plain keyword/phrase, not a hashtag URL
  const query = raw.replace(/^#/, "").trim();
  const limit = Math.min(Number(req.body?.limit) || 30, 50);
  // Each page yields ~12 reels; request enough pages to hit the desired limit
  const maxPages = Math.ceil(limit / 12);

  logger.info({ query, limit, maxPages }, "Starting reel keyword search via Apify");

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, maxPages }),
    }
  );

  if (!startRes.ok) {
    const err = await startRes.text();
    logger.error({ status: startRes.status, err }, "Apify search run start failed");
    res.status(502).json({ error: "Failed to start Apify search" });
    return;
  }

  const startData = (await startRes.json()) as { data: { id: string } };
  const runId = startData?.data?.id;
  if (!runId) {
    res.status(502).json({ error: "Apify returned no runId" });
    return;
  }

  logger.info({ runId, query }, "Apify keyword search run started");

  const succeeded = await pollRun(runId);
  if (!succeeded) {
    res.status(502).json({ error: "Apify search run failed or timed out" });
    return;
  }

  const itemsRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`
  );
  if (!itemsRes.ok) {
    res.status(502).json({ error: "Failed to fetch Apify results" });
    return;
  }

  const items = (await itemsRes.json()) as SearchReelItem[];
  if (!Array.isArray(items)) {
    res.status(502).json({ error: "Unexpected Apify response" });
    return;
  }

  logger.info({ query, rawCount: items.length }, "Apify returned raw items");

  const results = items
    .filter((item) => item.code || item.id)
    .map((item) => {
      const shortcode = item.code ?? item.id ?? "";
      const url = shortcode
        ? `https://www.instagram.com/reel/${shortcode}/`
        : null;
      return {
        url,
        shortcode,
        accountName: item.user?.username ?? item.ownerUsername ?? "unknown",
        caption: extractCaption(item.caption),
        thumbnailUrl:
          item.thumbnail_url ??
          item.display_url ??
          item.thumbnailUrl ??
          item.displayUrl ??
          null,
        videoUrl: item.video_url ?? item.videoUrl ?? null,
        viewCount: item.ig_play_count ?? item.play_count ?? null,
        likeCount: item.like_count ?? item.likesCount ?? null,
        commentsCount: item.comment_count ?? item.commentsCount ?? null,
        shareCount: item.share_count ?? null,
        takenAt: item.taken_at_date ?? item.timestamp ?? null,
      };
    })
    .filter((item) => item.url)
    .slice(0, limit)
    .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0));

  logger.info({ query, count: results.length }, "Reel keyword search complete");
  res.json({ results, hashtag: query });
});

export default router;
