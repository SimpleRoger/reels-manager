import { Router, type IRouter } from "express";
import { db, reelsTable, instagramAccountsTable } from "@workspace/db";
import { desc, eq } from "drizzle-orm";
import { runInstagramSync } from "../lib/sync";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

const DEFAULT_REELS_PER_ACCOUNT = 2;
const REELS_PER_ACCOUNT: Record<string, number> = {
  youaresooooamazing: 5,
};
const reelsLimit = (username: string) => REELS_PER_ACCOUNT[username] ?? DEFAULT_REELS_PER_ACCOUNT;

const reelFields = {
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
};

/**
 * GET /api/public/latest-reel
 * Returns the 2 most recent reels for each connected account (4 total for 2 accounts).
 * Syncs stale data first. No auth required.
 */
router.get("/public/latest-reel", async (_req, res): Promise<void> => {
  const accounts = await db.select().from(instagramAccountsTable);
  if (accounts.length === 0) {
    res.status(404).json({ error: "No accounts connected" });
    return;
  }

  const fetchPerAccount = () =>
    Promise.all(
      accounts.map((account) =>
        db
          .select(reelFields)
          .from(reelsTable)
          .where(eq(reelsTable.accountId, account.id))
          .orderBy(desc(reelsTable.postedAt))
          .limit(reelsLimit(account.username))
          .then((reels) => ({ username: account.username, reels }))
      )
    );

  let byAccount = await fetchPerAccount();

  // Sync if any account's data is stale
  const allReels = byAccount.flatMap((a) => a.reels);
  const oldestUpdateMs = allReels.reduce((min, r) => {
    return Math.min(min, r.updatedAt ? r.updatedAt.getTime() : 0);
  }, Infinity);

  if (!allReels.length || Date.now() - oldestUpdateMs > SYNC_COOLDOWN_MS) {
    logger.info("public/latest-reel: stale data, syncing");
    try {
      await runInstagramSync();
      byAccount = await fetchPerAccount();
    } catch (err) {
      logger.warn({ err }, "public/latest-reel: sync failed, returning cached data");
    }
  }

  const result = byAccount.flatMap(({ username, reels }) =>
    reels.map((r) => ({
      account: username,
      views: r.plays,
      likes: r.likeCount,
      comments: r.commentsCount,
      reach: r.reach,
      saves: r.saves,
      shares: r.shares,
      permalink: r.permalink,
      caption: r.caption,
      postedAt: r.postedAt,
      updatedAt: r.updatedAt,
      performanceStatus: r.performanceStatus,
    }))
  );

  res.json(result);
});

// GET /api/public/views-spoken — returns plain text for Shortcuts "Speak" action
// e.g. "roger.rari: 1st reel 15571 views, 2nd reel 12000 views. youaresooooamazing: 1st reel 5000 views, 2nd reel 3000 views."
router.get("/public/views-spoken", async (_req, res): Promise<void> => {
  const accounts = await db.select().from(instagramAccountsTable);
  if (accounts.length === 0) {
    res.type("text/plain").send("No accounts connected.");
    return;
  }

  const byAccount = await Promise.all(
    accounts.map((account) =>
      db
        .select({ plays: reelsTable.plays })
        .from(reelsTable)
        .where(eq(reelsTable.accountId, account.id))
        .orderBy(desc(reelsTable.postedAt))
        .limit(reelsLimit(account.username))
        .then((reels) => ({ username: account.username, reels }))
    )
  );

  const ordinals = ["1st", "2nd", "3rd", "4th"];
  const parts = byAccount.map(({ username, reels }) => {
    const reelParts = reels.map((r, i) =>
      `${ordinals[i] ?? `${i + 1}th`} reel ${r.plays?.toLocaleString() ?? "unknown"} views`
    );
    return `${username}: ${reelParts.join(", ")}`;
  });

  res.type("text/plain").send(parts.join(". ") + ".");
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
