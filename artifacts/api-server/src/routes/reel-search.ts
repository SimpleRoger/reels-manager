import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const APIFY_TOKEN = process.env["APIFY_API_TOKEN"];
const ACTOR_ID = "apify~instagram-scraper";

interface ApifyItem {
  url?: string;
  shortCode?: string;
  videoUrl?: string;
  displayUrl?: string;
  thumbnailUrl?: string;
  caption?: string;
  ownerUsername?: string;
  videoViewCount?: number;
  videoPlayCount?: number;
  likesCount?: number;
  likesCountFull?: number;
  commentsCount?: number;
  type?: string;
}

async function pollRun(runId: string): Promise<boolean> {
  const maxWait = 120_000;
  const interval = 3_000;
  const start = Date.now();

  while (Date.now() - start < maxWait) {
    await new Promise((r) => setTimeout(r, interval));
    const res = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    );
    if (!res.ok) break;
    const data = await res.json() as { data: { status: string } };
    const status = data?.data?.status;
    if (status === "SUCCEEDED") return true;
    if (status === "FAILED" || status === "ABORTED" || status === "TIMED-OUT") {
      logger.warn({ runId, status }, "Apify search run did not succeed");
      return false;
    }
  }
  return false;
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

  const hashtag = raw.replace(/^#/, "").trim();
  const limit = Math.min(Number(req.body?.limit) || 30, 50);

  logger.info({ hashtag, limit }, "Starting reel search via Apify");

  // Start the actor run
  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hashtags: [hashtag],
        resultsType: "posts",
        resultsLimit: limit,
        addParentData: false,
      }),
    }
  );

  if (!startRes.ok) {
    const err = await startRes.text();
    logger.error({ status: startRes.status, err }, "Apify search run start failed");
    res.status(502).json({ error: "Failed to start Apify search" });
    return;
  }

  const startData = await startRes.json() as { data: { id: string } };
  const runId = startData?.data?.id;
  if (!runId) {
    res.status(502).json({ error: "Apify returned no runId" });
    return;
  }

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

  const items = await itemsRes.json() as ApifyItem[];
  if (!Array.isArray(items)) {
    res.status(502).json({ error: "Unexpected Apify response" });
    return;
  }

  // Map to our shape and sort by comments desc
  const results = items
    .filter((item) => item.url && item.ownerUsername)
    .map((item) => ({
      url: item.url!,
      shortcode: item.shortCode ?? item.url?.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/)?.[1] ?? "",
      accountName: item.ownerUsername!,
      caption: item.caption ?? null,
      thumbnailUrl: item.displayUrl ?? item.thumbnailUrl ?? null,
      videoUrl: item.videoUrl ?? null,
      viewCount: item.videoViewCount ?? item.videoPlayCount ?? null,
      likeCount: item.likesCount ?? item.likesCountFull ?? null,
      commentsCount: item.commentsCount ?? null,
    }))
    .sort((a, b) => (b.commentsCount ?? 0) - (a.commentsCount ?? 0));

  logger.info({ hashtag, count: results.length }, "Reel search complete");
  res.json({ results, hashtag });
});

export default router;
