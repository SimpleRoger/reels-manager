import { eq, isNotNull, avg, and, sql } from "drizzle-orm";
import { db, instagramAccountsTable, reelsTable } from "@workspace/db";
import { computePerformanceStatus, fetchUserMedia, fetchMediaInsights } from "./instagram";
import { logger } from "./logger";

type Averages = {
  avgLikes: number;
  avgComments: number;
  avgReach: number | null;
  avgSaves: number | null;
  avgShares: number | null;
};

// Extract Instagram shortcode from a permalink URL
function permalinkShortcode(url: string): string | null {
  return url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/)?.[1] ?? null;
}

// Remove duplicate reels that point to the same Instagram post but have different
// instagramIds (Apify stored shortcodes, Graph API stores numeric IDs).
// Keeps the row with the most insight data; merges max metrics into it before
// deleting the duplicates.
export async function dedupReels(): Promise<number> {
  const allReels = await db
    .select()
    .from(reelsTable)
    .where(isNotNull(reelsTable.permalink));

  // Group by shortcode extracted from permalink
  const groups = new Map<string, typeof allReels>();
  for (const reel of allReels) {
    const key = permalinkShortcode(reel.permalink!) ?? reel.permalink!;
    const arr = groups.get(key) ?? [];
    arr.push(reel);
    groups.set(key, arr);
  }

  let deleted = 0;

  for (const [, group] of groups) {
    if (group.length <= 1) continue;

    // Prefer rows that have insight data; among ties prefer numeric instagramId
    group.sort((a, b) => {
      const score = (r: typeof a) =>
        (r.reach != null ? 4 : 0) +
        (r.saves != null ? 2 : 0) +
        (r.shares != null ? 2 : 0) +
        (r.plays != null ? 1 : 0) +
        (/^\d+$/.test(r.instagramId) ? 1 : 0);
      return score(b) - score(a);
    });

    const keeper = group[0]!;
    const dupes  = group.slice(1);

    const maxOf = (field: keyof typeof keeper) =>
      group.some((r) => r[field] != null)
        ? Math.max(...group.map((r) => (r[field] as number | null) ?? 0))
        : null;

    await db.update(reelsTable).set({
      likeCount:     maxOf("likeCount"),
      commentsCount: maxOf("commentsCount"),
      plays:         maxOf("plays"),
      reach:         maxOf("reach"),
      saves:         maxOf("saves"),
      shares:        maxOf("shares"),
      // prefer Graph API thumbnail if it looks like a proper CDN url
      thumbnailUrl:  group.find((r) => r.thumbnailUrl && r.reach != null)?.thumbnailUrl
                     ?? keeper.thumbnailUrl,
    }).where(eq(reelsTable.id, keeper.id));

    for (const dup of dupes) {
      await db.delete(reelsTable).where(eq(reelsTable.id, dup.id));
      deleted++;
    }
  }

  if (deleted > 0) logger.info({ deleted }, "Dedup: removed duplicate reels");
  return deleted;
}

async function syncViaGraphApi(
  token: string,
  accountId: string,
  accountDbId: number,
  averages: Averages
): Promise<{ synced: number; total: number }> {
  logger.info("Sync: using Graph API");

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

async function getAccountAverages(accountDbId: number): Promise<Averages> {
  const rows = await db
    .select({
      avgLikes:    avg(reelsTable.likeCount),
      avgComments: avg(reelsTable.commentsCount),
      avgReach:    avg(reelsTable.reach),
      avgSaves:    avg(reelsTable.saves),
      avgShares:   avg(reelsTable.shares),
    })
    .from(reelsTable)
    .where(and(isNotNull(reelsTable.likeCount), eq(reelsTable.accountId, accountDbId)));

  const avgs = rows[0] ?? {};
  return {
    avgLikes:    Number(avgs.avgLikes ?? 0),
    avgComments: Number(avgs.avgComments ?? 0),
    avgReach:    avgs.avgReach    != null ? Number(avgs.avgReach)    : null,
    avgSaves:    avgs.avgSaves    != null ? Number(avgs.avgSaves)    : null,
    avgShares:   avgs.avgShares   != null ? Number(avgs.avgShares)   : null,
  };
}

export async function runInstagramSync(
  filterAccountDbId?: number
): Promise<{ synced: number; total: number; deduped: number } | null> {
  const accounts = filterAccountDbId
    ? await db.select().from(instagramAccountsTable).where(eq(instagramAccountsTable.id, filterAccountDbId))
    : await db.select().from(instagramAccountsTable);

  if (accounts.length === 0) {
    logger.info("Sync: no Instagram accounts connected, skipping");
    return null;
  }

  let totalSynced = 0;
  let totalCount  = 0;

  for (const account of accounts) {
    if (!account.accessToken) {
      logger.warn({ username: account.username }, "Sync: skipping account — no Graph API token");
      continue;
    }

    logger.info({ username: account.username, accountDbId: account.id }, "Syncing account via Graph API");

    const averages = await getAccountAverages(account.id);

    try {
      const result = await syncViaGraphApi(
        account.accessToken,
        account.accountId ?? account.username,
        account.id,
        averages
      );

      await db
        .update(instagramAccountsTable)
        .set({ lastSynced: new Date() })
        .where(eq(instagramAccountsTable.id, account.id));

      logger.info({ username: account.username, synced: result.synced, total: result.total }, "Sync complete");
      totalSynced += result.synced;
      totalCount  += result.total;
    } catch (err) {
      logger.error({ err, username: account.username }, "Graph API sync failed");
    }
  }

  // Dedup after every sync to remove any old Apify duplicates
  const deduped = await dedupReels();

  if (totalCount === 0 && deduped === 0) return null;
  return { synced: totalSynced, total: totalCount, deduped };
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
