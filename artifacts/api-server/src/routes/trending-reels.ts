import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const APIFY_TOKEN = process.env["APIFY_API_TOKEN"];
const ACTOR_ID = "agentx~instagram-trending-scraper";

// Minimum likes for a result to be considered "viral"
const MIN_LIKES = 1_000;

interface TrendingItem {
  id?: string;
  code?: string;
  url?: string;
  username?: string;
  section?: string;
  topic?: string;
  type?: string;
  is_video?: boolean;
  caption?: string;
  timestamp?: number;
  date?: string;
  // Actual field names returned by agentx~instagram-trending-scraper
  likes?: number;
  comments?: number;
  plays?: number;
  // Legacy / alternate field names (fallbacks)
  like_count?: number;
  likesCount?: number;
  comment_count?: number;
  commentsCount?: number;
  play_count?: number;
  video_play_count?: number;
  videoViewCount?: number;
  thumbnail_url?: string;
  display_url?: string;
  thumbnailUrl?: string;
  image_url?: string;
  video_url?: string;
  videoUrl?: string;
}

function mapItem(item: TrendingItem) {
  const likeCount = item.likes ?? item.like_count ?? item.likesCount ?? null;
  const commentsCount = item.comments ?? item.comment_count ?? item.commentsCount ?? null;
  const viewCount = item.plays ?? item.play_count ?? item.video_play_count ?? item.videoViewCount ?? null;
  return {
    url: item.url ?? (item.code ? `https://www.instagram.com/p/${item.code}/` : null),
    shortcode: item.code ?? item.id ?? "",
    accountName: item.username ?? "unknown",
    section: item.section ?? null,
    topic: item.topic ?? null,
    type: item.type ?? null,
    isVideo: item.is_video ?? false,
    caption: item.caption ?? null,
    date: item.date ?? (item.timestamp ? new Date(item.timestamp * 1000).toISOString() : null),
    thumbnailUrl: item.thumbnail_url ?? item.thumbnailUrl ?? item.display_url ?? item.image_url ?? null,
    videoUrl: item.video_url ?? item.videoUrl ?? null,
    likeCount,
    commentsCount,
    viewCount,
  };
}

// POST /api/trending-reels — starts the Apify run and returns runId immediately
router.post("/trending-reels", async (req, res): Promise<void> => {
  if (!APIFY_TOKEN) {
    res.status(503).json({ error: "Apify not configured" });
    return;
  }

  const limit = Math.min(Number(req.body?.limit) || 30, 100);
  logger.info({ limit }, "Starting trending reels fetch via Apify");

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ max_results: limit, download_medias: "none" }),
    }
  );

  if (!startRes.ok) {
    const err = await startRes.text();
    logger.error({ status: startRes.status, err }, "Apify trending run start failed");
    res.status(502).json({ error: "Failed to start Apify trending scrape" });
    return;
  }

  const startData = (await startRes.json()) as { data: { id: string } };
  const runId = startData?.data?.id;
  if (!runId) {
    res.status(502).json({ error: "Apify returned no runId" });
    return;
  }

  logger.info({ runId }, "Apify trending run started");
  res.json({ runId });
});

// GET /api/trending-reels/status/:runId — poll run status; returns results when done
router.get("/trending-reels/status/:runId", async (req, res): Promise<void> => {
  if (!APIFY_TOKEN) {
    res.status(503).json({ error: "Apify not configured" });
    return;
  }

  const { runId } = req.params;

  const statusRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
  );
  if (!statusRes.ok) {
    res.status(502).json({ error: "Failed to check run status" });
    return;
  }

  const statusData = (await statusRes.json()) as { data: { status: string } };
  const status = statusData?.data?.status;

  if (status === "RUNNING" || status === "READY" || status === "ABORTING") {
    res.json({ status: "running" });
    return;
  }

  if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
    logger.warn({ runId, status }, "Apify trending run did not succeed");
    res.status(502).json({ error: `Apify run ${status.toLowerCase()}` });
    return;
  }

  // SUCCEEDED — fetch results
  const itemsRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`
  );
  if (!itemsRes.ok) {
    res.status(502).json({ error: "Failed to fetch Apify results" });
    return;
  }

  const items = (await itemsRes.json()) as TrendingItem[];
  if (!Array.isArray(items)) {
    res.status(502).json({ error: "Unexpected Apify response" });
    return;
  }

  logger.info({ runId, rawCount: items.length }, "Apify trending items returned");

  const results = items
    .filter((item) => item.url || item.code)
    .map(mapItem)
    .filter((item) => item.url);

  logger.info({ count: results.length }, "Trending reels fetch complete");
  res.json({ status: "done", results });
});

export default router;
