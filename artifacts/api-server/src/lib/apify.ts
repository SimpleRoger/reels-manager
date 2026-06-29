import { logger } from "./logger";

const APIFY_TOKEN = process.env["APIFY_API_TOKEN"];
const ACTOR_ID = "apify~instagram-scraper";
const PROFILE_ACTOR_ID = "apify~instagram-profile-scraper";

export interface ApifyReelResult {
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  videoViewCount: number | null;
  commentsCount: number | null;
  likesCount: number | null;
  caption: string | null;
  accountName: string | null;
}

export interface ApifyProfilePost {
  instagramId: string;
  shortCode: string | null;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  postedAt: Date | null;
  likesCount: number | null;
  commentsCount: number | null;
  plays: number | null;
  isVideo: boolean;
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
        proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
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

export async function scrapeInstagramProfile(username: string, _limit = 100): Promise<ApifyProfilePost[]> {
  if (!APIFY_TOKEN) {
    logger.warn("APIFY_API_TOKEN not set — skipping profile scrape");
    return [];
  }

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${PROFILE_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        usernames: [username],
        proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] },
      }),
    }
  );

  if (!startRes.ok) {
    const err = await startRes.text();
    logger.error({ status: startRes.status, err }, "Apify profile scrape start failed");
    return [];
  }

  const startData = (await startRes.json()) as { data: { id: string } };
  const runId = startData?.data?.id;
  if (!runId) {
    logger.error("Apify profile scrape returned no runId");
    return [];
  }

  logger.info({ runId, username }, "Apify profile scrape started");

  const succeeded = await pollRun(runId);
  if (!succeeded) return [];

  const itemsRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`
  );
  if (!itemsRes.ok) return [];

  const profiles = (await itemsRes.json()) as any[];
  const posts: any[] = profiles.flatMap((p: any) => p.latestPosts ?? []);

  if (posts.length === 0) {
    logger.warn({ runId }, "Apify profile scrape returned no posts");
    return [];
  }

  logger.info({ runId, count: posts.length }, "Apify profile scrape complete");

  return posts
    .filter((item: any) => item.type === "Video" || item.videoUrl)
    .map((item: any): ApifyProfilePost => ({
      instagramId: item.id ?? item.shortCode ?? String(item.timestamp),
      shortCode: item.shortCode ?? null,
      caption: item.caption ?? null,
      permalink: item.url ?? (item.shortCode ? `https://www.instagram.com/p/${item.shortCode}/` : null),
      thumbnailUrl: item.displayUrl ?? item.thumbnailUrl ?? null,
      mediaUrl: item.videoUrl ?? null,
      postedAt: item.timestamp ? new Date(item.timestamp) : null,
      likesCount: item.likesCount ?? null,
      commentsCount: item.commentsCount ?? null,
      plays: item.videoViewCount ?? item.videoPlayCount ?? null,
      isVideo: true,
    }));
}
