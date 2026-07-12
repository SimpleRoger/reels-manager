import { Router, type IRouter } from "express";
import { eq, asc } from "drizzle-orm";
import { db, instagramAccountsTable, reelsTable } from "@workspace/db";
import { ConnectInstagramBody } from "@workspace/api-zod";
import { getHashtagId, searchHashtagMedia, verifyToken } from "../lib/instagram";
import { runInstagramSync, dedupReels } from "../lib/sync";

const router: IRouter = Router();

// List all connected accounts
router.get("/instagram/accounts", async (_req, res): Promise<void> => {
  const accounts = await db
    .select()
    .from(instagramAccountsTable)
    .orderBy(asc(instagramAccountsTable.createdAt));

  res.json(
    accounts.map((a) => ({
      id: a.id,
      username: a.username,
      accountId: a.accountId,
      hasToken: !!a.accessToken,
      lastSynced: a.lastSynced?.toISOString() ?? null,
    }))
  );
});

// Backwards-compat status (first account)
router.get("/instagram/status", async (_req, res): Promise<void> => {
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

// Connect / update an account
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

  // Upsert: look up by accountId first, then by username
  const existingByAccountId = resolvedAccountId !== cleanUsername
    ? await db.select().from(instagramAccountsTable).where(eq(instagramAccountsTable.accountId, resolvedAccountId)).limit(1)
    : [];

  const existingByUsername = existingByAccountId.length === 0
    ? await db.select().from(instagramAccountsTable).where(eq(instagramAccountsTable.username, cleanUsername)).limit(1)
    : [];

  const existing = existingByAccountId[0] ?? existingByUsername[0];

  if (existing) {
    await db
      .update(instagramAccountsTable)
      .set({ username: cleanUsername, accountId: resolvedAccountId, accessToken: accessToken?.trim() || null })
      .where(eq(instagramAccountsTable.id, existing.id));
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

// Delete an account
router.delete("/instagram/account/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "");
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid account id" });
    return;
  }

  await db.delete(instagramAccountsTable).where(eq(instagramAccountsTable.id, id));
  res.json({ success: true });
});

// Sync a specific account
router.post("/instagram/account/:id/sync", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "");
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid account id" });
    return;
  }

  try {
    const result = await runInstagramSync(id);
    if (!result) {
      res.status(400).json({ error: "Sync failed — no posts returned" });
      return;
    }
    res.json({
      synced: result.synced,
      total: result.total,
      message: `Synced ${result.synced} new Reels, updated ${result.total - result.synced} existing`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to sync account");
    res.status(400).json({ error: "Sync failed. Check server logs." });
  }
});

// Sync all accounts
router.post("/instagram/sync", async (req, res): Promise<void> => {
  const accounts = await db.select().from(instagramAccountsTable);
  if (accounts.length === 0) {
    res.status(400).json({ error: "No Instagram account connected" });
    return;
  }

  try {
    const result = await runInstagramSync();
    if (!result) {
      res.status(400).json({ error: "Sync failed — ensure your account has a valid Graph API token." });
      return;
    }
    res.json({
      synced: result.synced,
      total: result.total,
      deduped: result.deduped,
      message: `Synced ${result.synced} new Reels, updated ${result.total - result.synced} existing${result.deduped > 0 ? `, removed ${result.deduped} duplicates` : ""}`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to sync Instagram media");
    res.status(400).json({ error: "Sync failed. Check server logs." });
  }
});

// One-shot dedup: removes duplicate reels from old Apify imports
router.post("/instagram/dedup", async (_req, res): Promise<void> => {
  const deleted = await dedupReels();
  res.json({ deleted, message: `Removed ${deleted} duplicate reels` });
});

// Decode an Instagram shortcode (e.g. from a permalink) to its numeric media ID.
// Instagram shortcodes are base64url-encoded big integers.
function shortcodeToId(shortcode: string): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  let id = BigInt(0);
  for (const char of shortcode) {
    const idx = chars.indexOf(char);
    if (idx !== -1) id = id * BigInt(64) + BigInt(idx);
  }
  return id.toString();
}

// Fetch fresh media_url + thumbnail_url for an Instagram reel given its permalink URL.
// Strategy 1: Graph API (works for own account's content).
// Strategy 2: Scrape og:video from the public Instagram page (works for anyone's public reels).
router.get("/instagram/fresh-media", async (req, res): Promise<void> => {
  const url = req.query["url"];
  if (typeof url !== "string") {
    res.status(400).json({ error: "url query parameter required" });
    return;
  }

  const shortcode = url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/)?.[1];
  if (!shortcode) {
    res.status(400).json({ error: "Could not extract shortcode from URL" });
    return;
  }

  // --- Strategy 1: Graph API (own content) ---
  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  const token = accounts[0]?.accessToken;

  if (token) {
    try {
      const numericId = shortcodeToId(shortcode);
      const base = token.startsWith("IGAA") ? "https://graph.instagram.com/v21.0" : "https://graph.facebook.com/v21.0";
      const fields = "media_url,thumbnail_url,permalink,media_product_type,media_type";
      const apiResp = await fetch(`${base}/${numericId}?fields=${fields}&access_token=${token}`);

      if (apiResp.ok) {
        const data = await apiResp.json() as {
          media_url?: string;
          thumbnail_url?: string;
          permalink?: string;
          media_product_type?: string;
          media_type?: string;
        };
        if (data.media_url) {
          // Persist fresh URL back to reels table if this is our own reel
          await db.update(reelsTable)
            .set({
              ...(data.thumbnail_url ? { thumbnailUrl: data.thumbnail_url } : {}),
              mediaUrl: data.media_url,
            })
            .where(eq(reelsTable.instagramId, numericId));

          res.json({
            mediaUrl: data.media_url,
            thumbnailUrl: data.thumbnail_url ?? null,
            permalink: data.permalink ?? null,
            mediaProductType: data.media_product_type ?? null,
            mediaType: data.media_type ?? null,
          });
          return;
        }
      }
    } catch {
      // fall through to Strategy 2
    }
  }

  // Instagram does not expose og:video in their page HTML — CDN video URLs
  // for other accounts' content are not obtainable without a third-party service.
  res.json({ mediaUrl: null, thumbnailUrl: null });
});

// Refresh a fresh thumbnail URL for a reel using the Graph API token.
// Called when the stored CDN URL has expired (they expire within hours).
router.get("/instagram/fresh-thumbnail/:instagramId", async (req, res): Promise<void> => {
  const instagramId = req.params["instagramId"];
  if (!instagramId) {
    res.status(400).json({ error: "instagramId required" });
    return;
  }

  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  const token = accounts[0]?.accessToken;
  if (!token) {
    res.status(400).json({ error: "No access token available" });
    return;
  }

  const base = token.startsWith("IGAA") ? "https://graph.instagram.com/v21.0" : "https://graph.facebook.com/v21.0";
  const fields = "media_url,thumbnail_url,permalink,media_product_type,media_type";
  const resp = await fetch(`${base}/${instagramId}?fields=${fields}&access_token=${token}`);
  if (!resp.ok) {
    res.status(502).json({ error: "Graph API error" });
    return;
  }

  const data = await resp.json() as { thumbnail_url?: string; media_url?: string };
  const freshUrl = data.thumbnail_url ?? data.media_url ?? null;

  if (freshUrl) {
    // Update the DB so future loads are instant
    await db.update(reelsTable).set({ thumbnailUrl: freshUrl }).where(eq(reelsTable.instagramId, instagramId));
  }

  res.json({ thumbnailUrl: freshUrl });
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

// GET /api/instagram/thumbnail?shortcode=X  (Instagram)
// GET /api/instagram/thumbnail?url=<tiktok_url>  (TikTok)
router.get("/instagram/thumbnail", async (req, res): Promise<void> => {
  const shortcode = req.query["shortcode"];
  const urlParam = req.query["url"];

  if (typeof urlParam === "string" && urlParam.includes("tiktok.com")) {
    try {
      const resolveResp = await fetch(urlParam, {
        method: "HEAD",
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        },
      });
      const canonicalUrl = resolveResp.url ?? urlParam;

      const pageResp = await fetch(canonicalUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
          "Accept": "text/html,application/xhtml+xml",
        },
      });

      if (!pageResp.ok) {
        res.status(404).json({ error: "TikTok page unavailable" });
        return;
      }

      const html = await pageResp.text();
      const match = html.match(/og:image" content="([^"]+)"/);
      if (!match) {
        res.status(404).json({ error: "No og:image found on TikTok page" });
        return;
      }

      const freshUrl = match[1].replace(/&amp;/g, "&");
      const imgResp = await fetch(freshUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        },
      });

      if (!imgResp.ok) {
        res.status(502).json({ error: "Could not fetch TikTok thumbnail from CDN" });
        return;
      }

      res.setHeader("Content-Type", imgResp.headers.get("content-type") ?? "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=3600");
      res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
      res.setHeader("Access-Control-Allow-Origin", "*");

      const buffer = await imgResp.arrayBuffer();
      res.send(Buffer.from(buffer));
      return;
    } catch (err) {
      req.log.warn({ err, url: urlParam }, "Failed to fetch TikTok thumbnail via og:image");
      res.status(502).json({ error: "Failed to fetch TikTok thumbnail" });
      return;
    }
  }

  if (typeof shortcode !== "string" || !shortcode) {
    res.status(400).json({ error: "shortcode or TikTok url required" });
    return;
  }

  try {
    const igResp = await fetch(`https://www.instagram.com/p/${shortcode}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml",
      },
    });

    if (!igResp.ok) {
      res.status(404).json({ error: "Instagram page unavailable" });
      return;
    }

    const html = await igResp.text();
    const match = html.match(/og:image" content="([^"]+)"/);
    if (!match) {
      res.status(404).json({ error: "No og:image found on page" });
      return;
    }

    const freshUrl = match[1].replace(/&amp;/g, "&");

    const imgResp = await fetch(freshUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
      },
    });

    if (!imgResp.ok) {
      res.status(502).json({ error: "Could not fetch thumbnail from CDN" });
      return;
    }

    res.setHeader("Content-Type", imgResp.headers.get("content-type") ?? "image/jpeg");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.setHeader("Access-Control-Allow-Origin", "*");

    const buffer = await imgResp.arrayBuffer();
    res.send(Buffer.from(buffer));
  } catch (err) {
    req.log.warn({ err, shortcode }, "Failed to fetch Instagram thumbnail via og:image");
    res.status(502).json({ error: "Failed to fetch thumbnail" });
  }
});

// GET /api/instagram/my-stats
// Returns view/like/comment counts for your single most recent reel.
router.get("/instagram/my-stats", async (req, res): Promise<void> => {
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
    data?: Array<{ id: string; caption?: string; permalink?: string; timestamp?: string; media_type?: string; media_product_type?: string; like_count?: number; comments_count?: number }>;
  };

  const item = mediaData.data?.[0];
  if (!item) { res.status(404).json({ error: "No media found" }); return; }

  // Fetch play count via insights
  let plays: number | null = null;
  const insightsResp = await fetch(
    `${base}/${item.id}/insights?metric=plays&access_token=${token}`
  ).catch(() => null);
  if (insightsResp?.ok) {
    const insights = await insightsResp.json() as { data?: Array<{ name: string; value?: number }> };
    plays = insights.data?.find((m) => m.name === "plays")?.value ?? null;
  }

  res.json({
    id: item.id,
    permalink: item.permalink ?? null,
    caption: item.caption ? item.caption.slice(0, 120) : null,
    postedAt: item.timestamp ?? null,
    plays,
    likes: item.like_count ?? null,
    comments: item.comments_count ?? null,
  });
});

export default router;
