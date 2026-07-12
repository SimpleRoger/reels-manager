import { eq, isNotNull, avg, sql, and } from "drizzle-orm";
import { db, instagramAccountsTable, reelsTable } from "@workspace/db";
import { computePerformanceStatus, fetchUserMedia, fetchMediaInsights } from "./instagram";
import { scrapeInstagramProfile } from "./apify";
import { logger } from "./logger";

type Averages = {
  avgLikes: number;
  avgComments: number;
  avgReach: number | null;
  avgSaves: number | null;
  avgShares: number | null;
};

async function syncViaGraphApi(
  token: string,
  accountId: string,
  accountDbId: number,
  averages: Averages
): Promise<{ synced: number; total: number }> {
  logger.info("Sync: using Graph API (token present)");

  const media = await fetchUserMedia(token, accountId);
  const reels = media.filter(
    (m) => m.media_type === "VIDEO" || m.media_product_type === "REELS"
  );

  logger.info({ count: reels.length }, "Graph API: fetched reels");

  let synced = 0;

  for (const reel of reels) {
    const insights = await fetchMediaInsights(reel.id, token);

    const existing = await db
      .select()
      .from(reelsTable)
      .where(eq(reelsTable.instagramId, reel.id))
      .limit(1);

    const prev = existing[0];

    const reelData = {
      accountId: accountDbId,
      instagramId: reel.id,
      caption: reel.caption ?? null,
      permalink: reel.permalink ?? null,
      thumbnailUrl: reel.thumbnail_url ?? null,
      mediaUrl: reel.media_url ?? null,
      postedAt: reel.timestamp ? new Date(reel.timestamp) : null,
      likeCount: reel.like_count != null && prev?.likeCount != null
        ? Math.max(reel.like_count, prev.likeCount)
        : (reel.like_count ?? prev?.likeCount ?? null),
      commentsCount: reel.comments_count != null && prev?.commentsCount != null
        ? Math.max(reel.comments_count, prev.commentsCount)
        : (reel.comments_count ?? prev?.commentsCount ?? null),
      plays: insights.views != null && prev?.plays != null
        ? Math.max(insights.views, prev.plays)
        : (insights.views ?? prev?.plays ?? null),
      reach: insights.reach != null && prev?.reach != null
        ? Math.max(insights.reach, prev.reach)
        : (insights.reach ?? prev?.reach ?? null),
      saves: insights.saved != null && prev?.saves != null
        ? Math.max(insights.saved, prev.saves)
        : (insights.saved ?? prev?.saves ?? null),
      shares: insights.shares != null && prev?.shares != null
        ? Math.max(insights.shares, prev.shares)
        : (insights.shares ?? prev?.shares ?? null),
      performanceStatus: null as string | null,
    };

    reelData.performanceStatus = computePerformanceStatus(reelData, averages);

    if (prev) {
      await db.update(reelsTable).set(reelData).where(eq(reelsTable.id, prev.id));
    } else {
      await db.insert(reelsTable).values({ ...reelData, tags: [] });
      synced++;
    }
  }

  return { synced, total: reels.length };
}

async function syncViaApify(
  username: string,
  accountDbId: number,
  averages: Averages
): Promise<{ synced: number; total: number } | null> {
  logger.info({ username }, "Sync: using Apify scraper (no token)");

  let posts;
  try {
    posts = await scrapeInstagramProfile(username, 200);
  } catch (err) {
    logger.error({ err }, "Auto-sync: failed to scrape Instagram profile via Apify");
    return null;
  }

  if (posts.length === 0) {
    logger.warn({ username }, "Auto-sync: Apify returned no posts");
    return null;
  }

  let synced = 0;

  for (const post of posts) {
    let existing = await db
      .select()
      .from(reelsTable)
      .where(eq(reelsTable.instagramId, post.instagramId))
      .limit(1);

    if (existing.length === 0 && post.shortCode) {
      existing = await db
        .select()
        .from(reelsTable)
        .where(sql`${reelsTable.permalink} LIKE ${"%" + post.shortCode + "%"}`)
        .limit(1);
    }

    const prev = existing[0];

    const reelData = {
      accountId: accountDbId,
      instagramId: post.instagramId,
      caption: post.caption,
      permalink: post.permalink,
      thumbnailUrl: post.thumbnailUrl,
      mediaUrl: post.mediaUrl,
      postedAt: post.postedAt,
      likeCount: post.likesCount != null && prev?.likeCount != null
        ? Math.max(post.likesCount, prev.likeCount)
        : (post.likesCount ?? prev?.likeCount ?? null),
      commentsCount: post.commentsCount != null && prev?.commentsCount != null
        ? Math.max(post.commentsCount, prev.commentsCount)
        : (post.commentsCount ?? prev?.commentsCount ?? null),
      plays: post.plays != null && prev?.plays != null
        ? Math.max(post.plays, prev.plays)
        : (post.plays ?? prev?.plays ?? null),
      reach: prev?.reach ?? null,
      saves: prev?.saves ?? null,
      shares: prev?.shares ?? null,
      performanceStatus: null as string | null,
    };

    reelData.performanceStatus = computePerformanceStatus(reelData, averages);

    if (prev) {
      await db.update(reelsTable).set(reelData).where(eq(reelsTable.id, prev.id));
    } else {
      await db.insert(reelsTable).values({ ...reelData, tags: [] });
      synced++;
    }
  }

  return { synced, total: posts.length };
}

async function getAccountAverages(accountDbId: number): Promise<Averages> {
  const rows = await db
    .select({
      avgLikes: avg(reelsTable.likeCount),
      avgComments: avg(reelsTable.commentsCount),
      avgReach: avg(reelsTable.reach),
      avgSaves: avg(reelsTable.saves),
      avgShares: avg(reelsTable.shares),
    })
    .from(reelsTable)
    .where(and(isNotNull(reelsTable.likeCount), eq(reelsTable.accountId, accountDbId)));

  const avgs = rows[0] ?? {};
  return {
    avgLikes: Number(avgs.avgLikes ?? 0),
    avgComments: Number(avgs.avgComments ?? 0),
    avgReach: avgs.avgReach != null ? Number(avgs.avgReach) : null,
    avgSaves: avgs.avgSaves != null ? Number(avgs.avgSaves) : null,
    avgShares: avgs.avgShares != null ? Number(avgs.avgShares) : null,
  };
}

export async function runInstagramSync(filterAccountDbId?: number): Promise<{ synced: number; total: number } | null> {
  const accounts = filterAccountDbId
    ? await db.select().from(instagramAccountsTable).where(eq(instagramAccountsTable.id, filterAccountDbId))
    : await db.select().from(instagramAccountsTable);

  if (accounts.length === 0) {
    logger.info("Auto-sync: no Instagram accounts connected, skipping");
    return null;
  }

  let totalSynced = 0;
  let totalCount = 0;

  for (const account of accounts) {
    logger.info({ username: account.username, accountDbId: account.id }, "Syncing account");

    const averages = await getAccountAverages(account.id);

    let result: { synced: number; total: number } | null = null;

    if (account.accessToken) {
      try {
        result = await syncViaGraphApi(account.accessToken, account.accountId ?? account.username, account.id, averages);
      } catch (err) {
        logger.error({ err, username: account.username }, "Graph API sync failed — falling back to Apify");
        result = await syncViaApify(account.username, account.id, averages);
      }
    } else {
      result = await syncViaApify(account.username, account.id, averages);
    }

    if (result) {
      await db
        .update(instagramAccountsTable)
        .set({ lastSynced: new Date() })
        .where(eq(instagramAccountsTable.id, account.id));

      logger.info({ username: account.username, synced: result.synced, total: result.total }, "Instagram sync complete");
      totalSynced += result.synced;
      totalCount += result.total;
    }
  }

  if (totalCount === 0) return null;
  return { synced: totalSynced, total: totalCount };
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
