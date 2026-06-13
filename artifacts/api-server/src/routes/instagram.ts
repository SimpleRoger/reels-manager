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

// GET /api/instagram/thumbnail?shortcode=X  (Instagram)
// GET /api/instagram/thumbnail?url=<tiktok_url>  (TikTok)
// Fetches a fresh thumbnail for a reel/TikTok by scraping the og:image from the
// public page. Signed CDN URLs in the DB expire; this refreshes them on demand.
router.get("/instagram/thumbnail", async (req, res): Promise<void> => {
  const shortcode = req.query["shortcode"];
  const urlParam = req.query["url"];

  // ── TikTok branch ─────────────────────────────────────────────────────────
  if (typeof urlParam === "string" && urlParam.includes("tiktok.com")) {
    try {
      // Follow redirects (short vt.tiktok.com links → canonical URL)
      const resolveResp = await fetch(urlParam, {
        method: "HEAD",
        redirect: "follow",
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15",
        },
      });
      const canonicalUrl = resolveResp.url ?? urlParam;

      // Fetch the TikTok page and extract og:image
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

  // ── Instagram branch ───────────────────────────────────────────────────────
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

    // Decode HTML entities in the URL (&amp; → &)
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

export default router;
