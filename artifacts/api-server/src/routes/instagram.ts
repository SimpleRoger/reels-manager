import { Router, type IRouter } from "express";
import { eq, desc, avg, isNotNull } from "drizzle-orm";
import { db, instagramAccountsTable, reelsTable } from "@workspace/db";
import {
  ConnectInstagramBody,
} from "@workspace/api-zod";
import {
  verifyToken,
  fetchUserMedia,
  fetchMediaInsights,
  computePerformanceStatus,
  getHashtagId,
  searchHashtagMedia,
} from "../lib/instagram";

const router: IRouter = Router();

router.post("/instagram/connect", async (req, res): Promise<void> => {
  const parsed = ConnectInstagramBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { accessToken } = parsed.data;

  const user = await verifyToken(accessToken);
  if (!user) {
    res.status(400).json({ error: "Invalid access token or unable to verify Instagram account" });
    return;
  }

  const existing = await db
    .select()
    .from(instagramAccountsTable)
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(instagramAccountsTable)
      .set({ accountId: user.id, username: user.username, accessToken })
      .where(eq(instagramAccountsTable.id, existing[0].id));
  } else {
    await db.insert(instagramAccountsTable).values({
      accountId: user.id,
      username: user.username,
      accessToken,
    });
  }

  req.log.info({ username: user.username }, "Instagram account connected");
  res.json({ success: true, username: user.username, accountId: user.id });
});

router.get("/instagram/status", async (req, res): Promise<void> => {
  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  
  if (accounts.length === 0) {
    res.json({ connected: false, username: null, accountId: null, lastSynced: null });
    return;
  }

  const account = accounts[0];
  res.json({
    connected: true,
    username: account.username,
    accountId: account.accountId,
    lastSynced: account.lastSynced?.toISOString() ?? null,
  });
});

router.post("/instagram/sync", async (req, res): Promise<void> => {
  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) {
    res.status(400).json({ error: "No Instagram account connected" });
    return;
  }

  const account = accounts[0];

  let media;
  try {
    media = await fetchUserMedia(account.accessToken, 30);
  } catch (err) {
    req.log.error({ err }, "Failed to fetch Instagram media");
    res.status(400).json({ error: "Failed to fetch Instagram media. Token may be expired." });
    return;
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

  const avgs = recentReels[0] ?? { avgLikes: null, avgComments: null, avgReach: null, avgSaves: null, avgShares: null };
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

    const reelData = {
      instagramId: m.id,
      caption: m.caption ?? null,
      permalink: m.permalink ?? null,
      thumbnailUrl: m.thumbnail_url ?? null,
      mediaUrl: m.media_url ?? null,
      postedAt: m.timestamp ? new Date(m.timestamp) : null,
      likeCount: m.like_count ?? null,
      commentsCount: m.comments_count ?? null,
      reach: insights.reach ?? null,
      saves: insights.saved ?? null,
      shares: insights.shares ?? null,
      plays: insights.plays ?? insights.video_views ?? null,
      performanceStatus: null as string | null,
    };

    const performanceStatus = computePerformanceStatus(reelData, averages);
    reelData.performanceStatus = performanceStatus;

    const existing = await db
      .select()
      .from(reelsTable)
      .where(eq(reelsTable.instagramId, m.id))
      .limit(1);

    if (existing.length > 0) {
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

  req.log.info({ synced, total: reelMedia.length }, "Instagram sync complete");
  res.json({ synced, total: reelMedia.length, message: `Synced ${synced} new Reels, updated ${reelMedia.length - synced} existing` });
});

router.get("/instagram/hashtag-search", async (req, res): Promise<void> => {
  const hashtag = req.query["hashtag"];
  const limit = Number(req.query["limit"] ?? 20);

  if (!hashtag || typeof hashtag !== "string") {
    res.status(400).json({ error: "hashtag query parameter required" });
    return;
  }

  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) {
    res.status(400).json({ error: "No Instagram account connected" });
    return;
  }

  const account = accounts[0];

  const hashtagId = await getHashtagId(hashtag, account.accessToken, account.accountId);
  if (!hashtagId) {
    res.json({ hashtag, media: [] });
    return;
  }

  const mediaResults = await searchHashtagMedia(hashtagId, account.accessToken, account.accountId, limit);

  const sorted = [...mediaResults].sort((a, b) => (b.comments_count ?? 0) - (a.comments_count ?? 0));

  res.json({
    hashtag,
    media: sorted.map((m) => ({
      id: m.id,
      mediaType: m.media_type,
      permalink: m.permalink ?? null,
      caption: m.caption ?? null,
      commentsCount: m.comments_count ?? null,
      likeCount: m.like_count ?? null,
      timestamp: m.timestamp ?? null,
    })),
  });
});

export default router;
