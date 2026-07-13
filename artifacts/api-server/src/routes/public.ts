import { Router, type IRouter } from "express";
import { db, reelsTable, instagramAccountsTable } from "@workspace/db";
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

// GET /api/instagram/my-stats — public, no auth required (used for personal testing/widgets)
router.get("/instagram/my-stats", async (_req, res): Promise<void> => {
  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  const token = accounts[0]?.accessToken;
  const accountId = accounts[0]?.accountId;

  if (!token || !accountId) {
    res.status(400).json({ error: "No Instagram account connected with a Graph API token" });
    return;
  }

  const base = token.startsWith("IGAA") ? "https://graph.instagram.com/v21.0" : "https://graph.facebook.com/v21.0";
  const fields = "id,caption,permalink,timestamp,media_type,media_product_type,like_count,comments_count";

  const mediaResp = await fetch(
    `${base}/${accountId}/media?fields=${fields}&limit=1&access_token=${token}`
  ).catch(() => null);

  if (!mediaResp?.ok) {
    res.status(502).json({ error: "Failed to fetch media from Graph API" });
    return;
  }

  const mediaData = await mediaResp.json() as {
    data?: Array<{ id: string; caption?: string; permalink?: string; timestamp?: string; like_count?: number; comments_count?: number }>;
  };

  const item = mediaData.data?.[0];
  if (!item) { res.status(404).json({ error: "No media found" }); return; }

  let views: number | null = null;
  const insightsResp = await fetch(
    `${base}/${item.id}/insights?metric=views,total_interactions&access_token=${token}`
  ).catch(() => null);
  if (insightsResp?.ok) {
    const insights = await insightsResp.json() as { data?: Array<{ name: string; values?: Array<{ value: number }>; value?: number }> };
    const metric = insights.data?.find((m) => m.name === "views");
    views = metric?.values?.[0]?.value ?? metric?.value ?? null;
  }

  res.json({
    id: item.id,
    permalink: item.permalink ?? null,
    caption: item.caption ? item.caption.slice(0, 120) : null,
    postedAt: item.timestamp ?? null,
    views,
    likes: item.like_count ?? null,
    comments: item.comments_count ?? null,
  });
});

export default router;
