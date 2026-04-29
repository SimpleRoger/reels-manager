import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const APIFY_TOKEN = process.env["APIFY_API_TOKEN"];
const ACTOR_ID = "agentx~instagram-trending-scraper";

interface TrendingItem {
  id?: string;
  code?: string;
  url?: string;
  username?: string;
  // Explore taxonomy
  section?: string;
  topic?: string;
  // Post type
  type?: string;
  is_video?: boolean;
  // Content
  caption?: string;
  timestamp?: number;
  date?: string;
  // Engagement
  like_count?: number;
  likesCount?: number;
  comment_count?: number;
  commentsCount?: number;
  play_count?: number;
  video_play_count?: number;
  videoViewCount?: number;
  // Media
  thumbnail_url?: string;
  display_url?: string;
  thumbnailUrl?: string;
  video_url?: string;
  videoUrl?: string;
}

async function pollRun(runId: string): Promise<boolean> {
  const maxWait = 300_000;
  const interval = 5_000;
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
      logger.warn({ runId, status }, "Apify trending run did not succeed");
      return false;
    }
  }
  return false;
}

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

  const succeeded = await pollRun(runId);
  if (!succeeded) {
    res.status(502).json({ error: "Apify trending run failed or timed out" });
    return;
  }

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

  logger.info({ rawCount: items.length }, "Apify trending items returned");

  const results = items
    .filter((item) => item.url || item.code)
    .map((item) => ({
      url: item.url ?? (item.code ? `https://www.instagram.com/reel/${item.code}/` : null),
      shortcode: item.code ?? item.id ?? "",
      accountName: item.username ?? "unknown",
      section: item.section ?? null,
      topic: item.topic ?? null,
      type: item.type ?? null,
      isVideo: item.is_video ?? false,
      caption: item.caption ?? null,
      date: item.date ?? (item.timestamp ? new Date(item.timestamp * 1000).toISOString() : null),
      thumbnailUrl: item.thumbnail_url ?? item.display_url ?? item.thumbnailUrl ?? null,
      videoUrl: item.video_url ?? item.videoUrl ?? null,
      viewCount: item.play_count ?? item.video_play_count ?? item.videoViewCount ?? null,
      likeCount: item.like_count ?? item.likesCount ?? null,
      commentsCount: item.comment_count ?? item.commentsCount ?? null,
    }))
    .filter((item) => item.url);

  logger.info({ count: results.length }, "Trending reels fetch complete");
  res.json({ results });
});

export default router;
