import { db, reelsTable, savedReferencesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

interface ResolvedMedia {
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  videoViewCount: number | null;
  commentsCount: number | null;
  likesCount: number | null;
  caption: string | null;
  accountName: string | null;
}

const APIFY_TOKEN = process.env["APIFY_API_TOKEN"];

const INSTAGRAM_ACTOR_ID = "apify~instagram-scraper";
const TIKTOK_ACTOR_ID = "scrape-creators/best-tiktok-video-scraper";

function isTikTokUrl(url: string): boolean {
  return url.includes("tiktok.com");
}

function isInstagramUrl(url: string): boolean {
  return url.includes("instagram.com");
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
    const data = (await res.json()) as { data: { status: string } };
    const status = data?.data?.status;
    if (status === "SUCCEEDED") return true;
    if (
      status === "FAILED" ||
      status === "ABORTED" ||
      status === "TIMED-OUT"
    ) {
      logger.warn({ runId, status }, "Apify run did not succeed");
      return false;
    }
  }
  return false;
}

async function runInstagramScraper(url: string): Promise<ResolvedMedia | null> {
  if (!APIFY_TOKEN) {
    logger.warn("APIFY_API_TOKEN not set — skipping Instagram scrape");
    return null;
  }

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${INSTAGRAM_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
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
    logger.error({ status: startRes.status, err }, "Instagram Apify run start failed");
    return null;
  }

  const startData = (await startRes.json()) as { data: { id: string } };
  const runId = startData?.data?.id;
  if (!runId) {
    logger.error("Instagram Apify run returned no runId");
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

async function runTikTokScraper(url: string): Promise<ResolvedMedia | null> {
  if (!APIFY_TOKEN) {
    logger.warn("APIFY_API_TOKEN not set — skipping TikTok scrape");
    return null;
  }

  const startRes = await fetch(
    `https://api.apify.com/v2/acts/${TIKTOK_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        videos: [url],
        shouldGetTranscript: false,
        shouldDownloadVideos: false,
        shouldDownloadCovers: false,
      }),
    }
  );

  if (!startRes.ok) {
    const err = await startRes.text();
    logger.error({ status: startRes.status, err }, "TikTok Apify run start failed");
    return null;
  }

  const startData = (await startRes.json()) as { data: { id: string } };
  const runId = startData?.data?.id;
  if (!runId) {
    logger.error("TikTok Apify run returned no runId");
    return null;
  }

  logger.info({ runId, url }, "TikTok Apify run started");

  const succeeded = await pollRun(runId);
  if (!succeeded) return null;

  const itemsRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`
  );
  if (!itemsRes.ok) return null;

  const items = (await itemsRes.json()) as any[];
  const item = Array.isArray(items) ? items[0] : null;
  if (!item) {
    logger.warn({ runId }, "TikTok Apify returned no items");
    return null;
  }

  logger.info({ runId, hasVideo: !!item.videoUrl }, "TikTok Apify scrape complete");

  return {
    mediaUrl: item.videoUrl ?? null,
    thumbnailUrl: item.thumbnail ?? item.thumbnailUrl ?? null,
    videoViewCount: item.playCount ?? null,
    commentsCount: item.commentCount ?? null,
    likesCount: item.likeCount ?? null,
    caption: item.description ?? null,
    accountName: item.author?.username ?? null,
  };
}

export async function resolveReelMedia(url: string): Promise<{
  mediaUrl: string | null;
  thumbnailUrl: string | null;
}> {
  // For Instagram: check if this is one of the user's own synced reels first
  if (isInstagramUrl(url)) {
    const all = await db
      .select({
        mediaUrl: reelsTable.mediaUrl,
        thumbnailUrl: reelsTable.thumbnailUrl,
        permalink: reelsTable.permalink,
      })
      .from(reelsTable);

    const base = url.replace(/\/$/, "");
    const own = all.find(
      (r) => r.permalink && r.permalink.replace(/\/$/, "") === base
    );
    if (own?.mediaUrl) {
      return { mediaUrl: own.mediaUrl, thumbnailUrl: own.thumbnailUrl ?? null };
    }
  }

  return { mediaUrl: null, thumbnailUrl: null };
}

// On startup: enrich any saved references that are still missing stats
export async function enrichMissingReferences(): Promise<void> {
  if (!APIFY_TOKEN) return;
  try {
    const missing = await db
      .select({
        id: savedReferencesTable.id,
        url: savedReferencesTable.url,
        viewCount: savedReferencesTable.viewCount,
        likeCount: savedReferencesTable.likeCount,
        commentsCount: savedReferencesTable.commentsCount,
      })
      .from(savedReferencesTable)
      .then((rows) =>
        rows.filter(
          (r) =>
            (isInstagramUrl(r.url) || isTikTokUrl(r.url)) &&
            r.viewCount == null &&
            r.likeCount == null &&
            r.commentsCount == null
        )
      );

    for (const ref of missing) {
      logger.info({ id: ref.id }, "Startup enrichment: queuing reference");
      await enrichReferenceWithApify(ref.id, ref.url);
    }
  } catch (err) {
    logger.error({ err }, "Startup enrichment failed");
  }
}

// Called in background after the reference row is saved — enriches it with Apify data
export async function enrichReferenceWithApify(
  referenceId: number,
  url: string
): Promise<void> {
  try {
    let result: ResolvedMedia | null = null;

    if (isTikTokUrl(url)) {
      result = await runTikTokScraper(url);
    } else if (isInstagramUrl(url)) {
      result = await runInstagramScraper(url);
    } else {
      logger.warn({ referenceId, url }, "Unsupported URL platform — skipping enrichment");
      return;
    }

    if (!result) return;

    await db
      .update(savedReferencesTable)
      .set({
        mediaUrl: result.mediaUrl ?? undefined,
        thumbnailUrl: result.thumbnailUrl ?? undefined,
        viewCount: result.videoViewCount ?? undefined,
        commentsCount: result.commentsCount ?? undefined,
        likeCount: result.likesCount ?? undefined,
        caption: result.caption ?? undefined,
        accountName: result.accountName ?? undefined,
      })
      .where(eq(savedReferencesTable.id, referenceId));

    logger.info({ referenceId }, "Reference enriched via Apify");
  } catch (err) {
    logger.error({ err, referenceId }, "Failed to enrich reference via Apify");
  }
}
