import { eq, isNotNull, avg, sql } from "drizzle-orm";
import { db, instagramAccountsTable, reelsTable } from "@workspace/db";
import { computePerformanceStatus } from "./instagram";
import { scrapeInstagramProfile } from "./apify";
import { logger } from "./logger";

export async function runInstagramSync(): Promise<{ synced: number; total: number } | null> {
  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) {
    logger.info("Auto-sync: no Instagram account connected, skipping");
    return null;
  }

  const account = accounts[0];
  const username = account.username;

  logger.info({ username }, "Auto-sync: scraping profile via Apify");

  let posts;
  try {
    posts = await scrapeInstagramProfile(username, 100);
  } catch (err) {
    logger.error({ err }, "Auto-sync: failed to scrape Instagram profile via Apify");
    return null;
  }

  if (posts.length === 0) {
    logger.warn({ username }, "Auto-sync: Apify returned no posts");
    return null;
  }

  const recentReels = await db
    .select({
      avgLikes: avg(reelsTable.likeCount),
      avgComments: avg(reelsTable.commentsCount),
      avgReach: avg(reelsTable.reach),
      avgSaves: avg(reelsTable.saves),
      avgShares: avg(reelsTable.shares),
    })
    .from(reelsTable)
    .where(isNotNull(reelsTable.likeCount));

  const avgs = recentReels[0] ?? {
    avgLikes: null,
    avgComments: null,
    avgReach: null,
    avgSaves: null,
    avgShares: null,
  };

  const averages = {
    avgLikes: Number(avgs.avgLikes ?? 0),
    avgComments: Number(avgs.avgComments ?? 0),
    avgReach: avgs.avgReach != null ? Number(avgs.avgReach) : null,
    avgSaves: avgs.avgSaves != null ? Number(avgs.avgSaves) : null,
    avgShares: avgs.avgShares != null ? Number(avgs.avgShares) : null,
  };

  let synced = 0;

  for (const post of posts) {
    // Primary lookup by instagramId
    let existing = await db
      .select()
      .from(reelsTable)
      .where(eq(reelsTable.instagramId, post.instagramId))
      .limit(1);

    // Fallback: match by shortCode in permalink (handles Graph API /reel/ vs Apify /p/ mismatch)
    if (existing.length === 0 && post.shortCode) {
      existing = await db
        .select()
        .from(reelsTable)
        .where(sql`${reelsTable.permalink} LIKE ${"%" + post.shortCode + "%"}`)
        .limit(1);
    }

    const prev = existing[0];

    const reelData = {
      instagramId: post.instagramId,
      caption: post.caption,
      permalink: post.permalink,
      thumbnailUrl: post.thumbnailUrl,
      mediaUrl: post.mediaUrl,
      postedAt: post.postedAt,
      likeCount: post.likesCount,
      commentsCount: post.commentsCount,
      plays: post.plays,
      reach: prev?.reach ?? null,
      saves: prev?.saves ?? null,
      shares: prev?.shares ?? null,
      performanceStatus: null as string | null,
    };

    const performanceStatus = computePerformanceStatus(reelData, averages);
    reelData.performanceStatus = performanceStatus;

    if (prev) {
      await db
        .update(reelsTable)
        .set(reelData)
        .where(eq(reelsTable.id, prev.id));
    } else {
      await db.insert(reelsTable).values({ ...reelData, tags: [] });
      synced++;
    }
  }

  await db
    .update(instagramAccountsTable)
    .set({ lastSynced: new Date() })
    .where(eq(instagramAccountsTable.id, account.id));

  logger.info({ synced, total: posts.length }, "Instagram sync complete");
  return { synced, total: posts.length };
}

const THIRTY_MINUTES = 30 * 60 * 1000;

export function startAutoSync() {
  logger.info("Auto-sync: scheduled every 30 minutes");
  setInterval(async () => {
    logger.info("Auto-sync: running scheduled sync");
    try {
      await runInstagramSync();
    } catch (err) {
      logger.error({ err }, "Auto-sync: unhandled error during sync");
    }
  }, THIRTY_MINUTES);
}

function msUntilSydney7am(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-AU", {
    timeZone: "Australia/Sydney",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(now);
  const h = parseInt(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = parseInt(parts.find((p) => p.type === "minute")?.value ?? "0");
  const s = parseInt(parts.find((p) => p.type === "second")?.value ?? "0");
  const elapsed = h * 3600 + m * 60 + s;
  const until = 7 * 3600 - elapsed;
  return (until <= 0 ? until + 86400 : until) * 1000;
}

export function scheduleDailySydneySync() {
  function scheduleNext() {
    const delay = msUntilSydney7am();
    const hours = Math.round((delay / 3600000) * 10) / 10;
    logger.info({ hoursUntilNext: hours }, "Auto-sync: daily 7am Sydney sync scheduled");
    setTimeout(async () => {
      logger.info("Auto-sync: running daily 7am Sydney sync");
      try {
        await runInstagramSync();
      } catch (err) {
        logger.error({ err }, "Auto-sync: daily Sydney sync error");
      }
      scheduleNext();
    }, delay);
  }
  scheduleNext();
}
