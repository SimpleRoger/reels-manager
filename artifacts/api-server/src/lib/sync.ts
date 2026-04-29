import { eq, desc, avg, isNotNull } from "drizzle-orm";
import { db, instagramAccountsTable, reelsTable } from "@workspace/db";
import {
  fetchUserMedia,
  fetchMediaInsights,
  computePerformanceStatus,
} from "./instagram";
import { logger } from "./logger";

export async function runInstagramSync(): Promise<{ synced: number; total: number } | null> {
  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) {
    logger.info("Auto-sync: no Instagram account connected, skipping");
    return null;
  }

  const account = accounts[0];

  let media;
  try {
    media = await fetchUserMedia(account.accessToken);
  } catch (err) {
    logger.error({ err }, "Auto-sync: failed to fetch Instagram media");
    return null;
  }

  const reelMedia = media.filter(
    (m) => m.media_type === "VIDEO" || m.media_product_type === "REELS"
  );

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
  for (const m of reelMedia) {
    const insights = await fetchMediaInsights(m.id, account.accessToken);

    const existing = await db
      .select()
      .from(reelsTable)
      .where(eq(reelsTable.instagramId, m.id))
      .limit(1);

    const prev = existing[0];

    const reach = insights.reach ?? prev?.reach ?? null;
    const saves = insights.saved ?? prev?.saves ?? null;
    const shares = insights.shares ?? prev?.shares ?? null;
    const plays = insights.views ?? prev?.plays ?? null;

    const reelData = {
      instagramId: m.id,
      caption: m.caption ?? null,
      permalink: m.permalink ?? null,
      thumbnailUrl: m.thumbnail_url ?? null,
      mediaUrl: m.media_url ?? null,
      postedAt: m.timestamp ? new Date(m.timestamp) : null,
      likeCount: m.like_count ?? null,
      commentsCount: m.comments_count ?? null,
      reach,
      saves,
      shares,
      plays,
      performanceStatus: null as string | null,
    };

    const performanceStatus = computePerformanceStatus(reelData, averages);
    reelData.performanceStatus = performanceStatus;

    if (prev) {
      await db
        .update(reelsTable)
        .set(reelData)
        .where(eq(reelsTable.instagramId, m.id));
    } else {
      await db.insert(reelsTable).values({ ...reelData, tags: [] });
      synced++;
    }
  }

  await db
    .update(instagramAccountsTable)
    .set({ lastSynced: new Date() })
    .where(eq(instagramAccountsTable.id, account.id));

  logger.info({ synced, total: reelMedia.length }, "Instagram sync complete");
  return { synced, total: reelMedia.length };
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
