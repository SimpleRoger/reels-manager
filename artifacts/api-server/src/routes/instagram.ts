import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, instagramAccountsTable } from "@workspace/db";
import { ConnectInstagramBody } from "@workspace/api-zod";
import { getHashtagId, searchHashtagMedia, verifyToken } from "../lib/instagram";
import { runInstagramSync } from "../lib/sync";

const router: IRouter = Router();

router.post("/instagram/connect", async (req, res): Promise<void> => {
  const parsed = ConnectInstagramBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { username, accessToken } = parsed.data;
  const cleanUsername = username.replace(/^@/, "").trim();

  if (!cleanUsername) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  // If a token was provided, validate it and get the real account ID
  let resolvedAccountId = cleanUsername;
  let tokenValid = false;

  if (accessToken && accessToken.trim()) {
    const tokenInfo = await verifyToken(accessToken.trim());
    if (tokenInfo) {
      resolvedAccountId = tokenInfo.id;
      tokenValid = true;
      req.log.info({ username: tokenInfo.username, accountId: tokenInfo.id }, "Graph API token validated");
    } else {
      req.log.warn({ username: cleanUsername }, "Provided token is invalid or expired — saving username only");
    }
  }

  const existing = await db.select().from(instagramAccountsTable).limit(1);

  if (existing.length > 0) {
    await db
      .update(instagramAccountsTable)
      .set({
        username: cleanUsername,
        accountId: resolvedAccountId,
        accessToken: accessToken?.trim() || null,
      })
      .where(eq(instagramAccountsTable.id, existing[0].id));
  } else {
    await db.insert(instagramAccountsTable).values({
      accountId: resolvedAccountId,
      username: cleanUsername,
      accessToken: accessToken?.trim() || null,
    });
  }

  req.log.info({ username: cleanUsername, tokenValid }, "Instagram account connected");
  res.json({ success: true, username: cleanUsername, accountId: resolvedAccountId, tokenValid });
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
    hasToken: !!account.accessToken,
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
      res.status(400).json({ error: "Sync failed — Apify returned no posts. Check the username is correct." });
      return;
    }
    res.json({
      synced: result.synced,
      total: result.total,
      message: `Synced ${result.synced} new Reels, updated ${result.total - result.synced} existing`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to sync Instagram media");
    res.status(400).json({ error: "Sync failed. Check server logs." });
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
  if (!account.accessToken) {
    res.status(400).json({ error: "Hashtag search requires an Instagram access token" });
    return;
  }

  const hashtagId = await getHashtagId(hashtag, account.accessToken, account.accountId ?? "");
  if (!hashtagId) {
    res.json({ hashtag, media: [] });
    return;
  }

  const mediaResults = await searchHashtagMedia(hashtagId, account.accessToken, account.accountId ?? "", limit);
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
