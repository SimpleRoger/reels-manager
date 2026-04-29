import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, instagramAccountsTable, reelsTable } from "@workspace/db";
import {
  ConnectInstagramBody,
} from "@workspace/api-zod";
import {
  verifyToken,
  getHashtagId,
  searchHashtagMedia,
} from "../lib/instagram";
import { runInstagramSync } from "../lib/sync";

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

  try {
    const result = await runInstagramSync();
    if (!result) {
      res.status(400).json({ error: "Failed to fetch Instagram media. Token may be expired." });
      return;
    }
    res.json({
      synced: result.synced,
      total: result.total,
      message: `Synced ${result.synced} new Reels, updated ${result.total - result.synced} existing`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to sync Instagram media");
    res.status(400).json({ error: "Failed to fetch Instagram media. Token may be expired." });
  }
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
