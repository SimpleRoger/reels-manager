import { Router, type IRouter } from "express";
import { db, reelsTable } from "@workspace/db";
import { desc } from "drizzle-orm";
import { runInstagramSync } from "../lib/sync";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

/**
 * GET /api/public/latest-reel
 * Returns stats for the most recently posted reel.
 * If data is older than 5 minutes, runs a full sync first (waits for it)
 * so the response always has fresh numbers. No auth required.
 */
router.get("/public/latest-reel", async (_req, res): Promise<void> => {
  const getLatest = () =>
    db
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

  let [reel] = await getLatest();

  if (!reel) {
    res.status(404).json({ error: "No reels found" });
    return;
  }

  const ageMs = reel.updatedAt ? Date.now() - reel.updatedAt.getTime() : Infinity;

  if (ageMs > SYNC_COOLDOWN_MS) {
    logger.info({ ageMs }, "public/latest-reel: stale data, syncing now");
    try {
      await runInstagramSync();
      // Re-fetch after sync so we return the freshest numbers
      [reel] = await getLatest();
    } catch (err) {
      logger.warn({ err }, "public/latest-reel: sync failed, returning cached data");
    }
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
  });
});

export default router;
