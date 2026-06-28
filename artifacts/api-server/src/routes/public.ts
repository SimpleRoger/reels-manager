import { Router, type IRouter } from "express";
import { db, reelsTable } from "@workspace/db";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

/**
 * GET /api/public/latest-reel
 * Returns stats for the most recently posted reel.
 * No auth required — safe to hit from widgets, scripts, etc.
 */
router.get("/public/latest-reel", async (_req, res): Promise<void> => {
  const [reel] = await db
    .select({
      id: reelsTable.id,
      instagramId: reelsTable.instagramId,
      permalink: reelsTable.permalink,
      caption: reelsTable.caption,
      postedAt: reelsTable.postedAt,
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
    performanceStatus: reel.performanceStatus,
  });
});

export default router;
