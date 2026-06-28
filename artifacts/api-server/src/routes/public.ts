import { Router, type IRouter } from "express";
import { db, reelsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { runInstagramSync } from "../lib/sync";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
let syncInFlight = false;

/**
 * GET /api/public/latest-reel
 * Returns stats for the most recently posted reel immediately from cache.
 * If data is older than 5 minutes, kicks off a background sync so the next
 * call gets fresher numbers. No auth required — safe to hit from anywhere.
 */
router.get("/public/latest-reel", async (_req, res): Promise<void> => {
  const [reel] = await db
    .select({
      permalink: reelsTable.permalink,
      caption: reelsTable.caption,
      postedAt: reelsTable.postedAt,
      updatedAt: reelsTable.updatedAt,
      plays: reelsTable.plays,
      likeCount: reelsTable.likeCount,
      commentsCount: reelsTable.commentsCount,
      reach: reelsTable.reach,
      saves: reelsTable.saves,
      shares: reelsTable.shares,
      performanceStatus: reelsTable.performanceStatus,
    })
    .from(reelsTable)
    .orderBy(desc(reelsTable.postedAt))
    .limit(1);

  if (!reel) {
    res.status(404).json({ error: "No reels found" });
    return;
  }

  // Trigger a background sync if data is stale and no sync is already running
  const ageMs = reel.updatedAt ? Date.now() - reel.updatedAt.getTime() : Infinity;
  if (ageMs > SYNC_COOLDOWN_MS && !syncInFlight) {
    syncInFlight = true;
    logger.info({ ageMs }, "public/latest-reel: stale data, syncing in background");
    runInstagramSync()
      .catch((err) => logger.warn({ err }, "public/latest-reel: background sync failed"))
      .finally(() => { syncInFlight = false; });
  }

  res.json({
    views: reel.plays,
    likes: reel.likeCount,
    comments: reel.commentsCount,
    reach: reel.reach,
    saves: reel.saves,
    shares: reel.shares,
    permalink: reel.permalink,
    caption: reel.caption,
    postedAt: reel.postedAt,
    updatedAt: reel.updatedAt,
    performanceStatus: reel.performanceStatus,
    syncingInBackground: ageMs > SYNC_COOLDOWN_MS,
  });
});

export default router;
