import { logger } from "./logger";

const APIFY_TOKEN = process.env["APIFY_API_TOKEN"];
const ACTOR_ID = "apify~instagram-scraper";

export interface ApifyReelResult {
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  videoViewCount: number | null;
  commentsCount: number | null;
  likesCount: number | null;
  caption: string | null;
  accountName: string | null;
}

export async function pollRun(runId: string): Promise<boolean> {
  const maxWait = 120_000;
  const interval = 3_000;
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
      logger.warn({ runId, status }, "Apify run did not succeed");
      return false;
    }
  }
  return false;
}

export async function scrapeInstagramReel(url: string): Promise<ApifyReelResult | null> {
  if (!APIFY_TOKEN) {
    logger.warn("APIFY_API_TOKEN not set — skipping scrape");
    return null;
  }

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        directUrls: [url],
        resultsType: "posts",
        resultsLimit: 1,
        addParentData: false,
      }),
    }
  );

  if (!startRes.ok) {
    const err = await startRes.text();
    logger.error({ status: startRes.status, err }, "Apify run start failed");
    return null;
  }

  const startData = (await startRes.json()) as { data: { id: string } };
  const runId = startData?.data?.id;
  if (!runId) {
    logger.error("Apify run returned no runId");
    return null;
  }

  logger.info({ runId, url }, "Apify run started");

  const succeeded = await pollRun(runId);
  if (!succeeded) return null;

  const itemsRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`
  );
  if (!itemsRes.ok) return null;

  const items = (await itemsRes.json()) as any[];
  const item = Array.isArray(items) ? items[0] : null;
  if (!item) {
    logger.warn({ runId }, "Apify returned no items");
    return null;
  }

  logger.info({ runId, hasVideo: !!item.videoUrl }, "Apify scrape complete");

  return {
    mediaUrl: item.videoUrl ?? null,
    thumbnailUrl: item.displayUrl ?? item.thumbnailUrl ?? null,
    videoViewCount: item.videoViewCount ?? item.videoPlayCount ?? null,
    commentsCount: item.commentsCount ?? null,
    likesCount: item.likesCount ?? item.likesCountFull ?? null,
    caption: item.caption ?? null,
    accountName: item.ownerUsername ?? null,
  };
}
