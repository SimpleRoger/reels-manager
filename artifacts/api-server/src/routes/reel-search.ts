import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const APIFY_TOKEN = process.env["APIFY_API_TOKEN"];
const ACTOR_ID = "apify~instagram-scraper";

interface ApifyItem {
  // URL fields — different versions use different keys
  url?: string;
  permalink?: string;
  shortCode?: string;
  // Video
  videoUrl?: string;
  videoSrc?: string;
  // Thumbnail
  displayUrl?: string;
  thumbnailUrl?: string;
  imageUrl?: string;
  // Caption / owner
  caption?: string;
  ownerUsername?: string;
  username?: string;
  // Engagement
  videoViewCount?: number;
  videoPlayCount?: number;
  playCount?: number;
  likesCount?: number;
  likesCountFull?: number;
  likes?: number;
  commentsCount?: number;
  comments?: number;
  // Type
  type?: string;
  productType?: string;
  isVideo?: boolean;
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

function resolveUrl(item: ApifyItem, hashtag: string): string | null {
  if (item.url) return item.url;
  if (item.permalink) return item.permalink;
  if (item.shortCode) return `https://www.instagram.com/reel/${item.shortCode}/`;
  return null;
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

  // Use the explore/tags URL as directUrl — more reliable than the hashtags input field
  const exploreUrl = `https://www.instagram.com/explore/tags/${encodeURIComponent(hashtag)}/`;

  logger.info({ hashtag, limit, exploreUrl }, "Starting reel search via Apify");

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [exploreUrl],
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

  logger.info({ hashtag, rawCount: items.length }, "Apify returned raw items");

  const results = items
    .map((item) => ({
      url: resolveUrl(item, hashtag),
      shortcode: item.shortCode ?? resolveUrl(item, hashtag)?.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/)?.[1] ?? "",
      accountName: item.ownerUsername ?? item.username ?? "unknown",
      caption: item.caption ?? null,
      thumbnailUrl: item.displayUrl ?? item.thumbnailUrl ?? item.imageUrl ?? null,
      videoUrl: item.videoUrl ?? item.videoSrc ?? null,
      viewCount: item.videoViewCount ?? item.videoPlayCount ?? item.playCount ?? null,
      likeCount: item.likesCount ?? item.likesCountFull ?? item.likes ?? null,
      commentsCount: item.commentsCount ?? item.comments ?? null,
    }))
    // Keep anything that has either a URL or a shortcode — don't be too strict
    .filter((item) => item.url || item.shortcode)
    .sort((a, b) => (b.commentsCount ?? 0) - (a.commentsCount ?? 0));

  logger.info({ hashtag, count: results.length }, "Reel search complete");
  res.json({ results, hashtag });
});

export default router;
