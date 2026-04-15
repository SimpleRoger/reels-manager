import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, instagramAccountsTable, savedReferencesTable } from "@workspace/db";

const router: IRouter = Router();

const FB_BASE = "https://graph.facebook.com/v21.0";

// Regex to find Instagram reel/post URLs in message text
const REEL_URL_RE = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+\/?(?:\?[^\s]*)*/gi;

async function fbGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${FB_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const data = await res.json() as { error?: { message: string; code: number; type?: string }; [k: string]: unknown };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Facebook API error ${res.status}`);
  }
  return data;
}

async function getPageToken(): Promise<{ token: string; accountId: string } | null> {
  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) return null;
  const token = accounts[0].pageAccessToken;
  if (!token) return null;
  return { token, accountId: accounts[0].accountId };
}

// POST /api/dm-importer/page-token — save Facebook Page access token
router.post("/dm-importer/page-token", async (req, res): Promise<void> => {
  const { pageAccessToken } = req.body as { pageAccessToken?: string };
  if (!pageAccessToken || typeof pageAccessToken !== "string" || pageAccessToken.trim().length < 10) {
    res.status(400).json({ error: "pageAccessToken is required" });
    return;
  }

  // Verify the token works
  try {
    const url = new URL(`${FB_BASE}/me`);
    url.searchParams.set("fields", "id,name");
    url.searchParams.set("access_token", pageAccessToken.trim());
    const r = await fetch(url.toString());
    const data = await r.json() as { error?: { message: string }; id?: string; name?: string };
    if (data.error) {
      res.status(400).json({ error: `Token verification failed: ${data.error.message}` });
      return;
    }
    req.log.info({ pageId: data.id, name: data.name }, "Page token verified");
  } catch (err) {
    res.status(400).json({ error: "Could not verify token" });
    return;
  }

  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) {
    res.status(400).json({ error: "No Instagram account connected yet — connect your account first" });
    return;
  }

  await db
    .update(instagramAccountsTable)
    .set({ pageAccessToken: pageAccessToken.trim() })
    .where(eq(instagramAccountsTable.id, accounts[0].id));

  res.json({ success: true });
});

// GET /api/dm-importer/status — check if page token is configured
router.get("/dm-importer/status", async (req, res): Promise<void> => {
  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) {
    res.json({ hasPageToken: false });
    return;
  }
  res.json({ hasPageToken: !!accounts[0].pageAccessToken });
});

// GET /api/dm-importer/conversations — list DM conversations using Page token
router.get("/dm-importer/conversations", async (req, res): Promise<void> => {
  const tokenInfo = await getPageToken();
  if (!tokenInfo) {
    res.status(400).json({
      error: "No Facebook Page token",
      details: "Add your Facebook Page access token in Settings → DM Importer to use this feature.",
    });
    return;
  }

  try {
    const data = await fbGet(`/me/conversations`, tokenInfo.token, {
      platform: "instagram",
      fields: "id,updated_time,participants",
      limit: "20",
    }) as {
      data?: Array<{ id: string; updated_time: string; participants?: { data: Array<{ name?: string; username?: string; id: string }> } }>;
    };

    const conversations = (data.data ?? []).map((c) => {
      const others = (c.participants?.data ?? []).filter((p) => p.id !== tokenInfo.accountId);
      const name = others[0]?.username
        ? `@${others[0].username}`
        : others[0]?.name ?? `Conversation ${c.id.slice(-6)}`;
      return { id: c.id, name, updatedTime: c.updated_time };
    });

    res.json({ conversations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Failed to fetch DM conversations");
    res.status(500).json({ error: message });
  }
});

// GET /api/dm-importer/conversations/:id/messages
router.get("/dm-importer/conversations/:id/messages", async (req, res): Promise<void> => {
  const tokenInfo = await getPageToken();
  if (!tokenInfo) {
    res.status(400).json({ error: "No Facebook Page token configured" });
    return;
  }

  const conversationId = req.params["id"];

  try {
    // Step 1: get message IDs from the conversation
    const convoData = await fbGet(`/${conversationId}`, tokenInfo.token, {
      fields: "messages",
    }) as {
      messages?: { data: Array<{ id: string; created_time: string }> };
      id?: string;
    };

    const messageIds = convoData.messages?.data ?? [];

    // Step 2: fetch content for each message (API only supports last 20)
    const reelUrls: Array<{ url: string; messageId: string; createdTime: string; from?: string }> = [];
    const totalMessages = messageIds.length;

    await Promise.all(
      messageIds.map(async (msg) => {
        try {
          const msgData = await fbGet(`/${msg.id}`, tokenInfo.token, {
            fields: "id,created_time,from,to,message",
          }) as {
            id: string;
            created_time: string;
            from?: { username?: string; id: string };
            message?: string;
          };

          if (!msgData.message) return;

          const matches = msgData.message.match(REEL_URL_RE);
          if (matches) {
            for (const url of matches) {
              const cleanUrl = url.replace(/\?.*$/, "").replace(/\/$/, "");
              reelUrls.push({
                url: cleanUrl,
                messageId: msg.id,
                createdTime: msgData.created_time,
                from: msgData.from?.username,
              });
            }
          }
        } catch {
          // Individual message fetch can fail for old messages — skip
        }
      })
    );

    reelUrls.sort((a, b) => new Date(b.createdTime).getTime() - new Date(a.createdTime).getTime());

    res.json({ totalMessages, reelUrls });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Failed to fetch conversation messages");
    res.status(500).json({ error: message });
  }
});

// POST /api/dm-importer/import — bulk save reel URLs to Remake List
router.post("/dm-importer/import", async (req, res): Promise<void> => {
  const { urls } = req.body as { urls?: string[] };
  if (!Array.isArray(urls) || urls.length === 0) {
    res.status(400).json({ error: "urls array is required" });
    return;
  }

  let imported = 0;
  let skipped = 0;

  const existingRefs = await db.select({ url: savedReferencesTable.url }).from(savedReferencesTable);
  const existingUrls = new Set(existingRefs.map((r) => r.url));

  for (const url of urls) {
    if (!url || typeof url !== "string") continue;

    if (existingUrls.has(url)) {
      skipped++;
      continue;
    }

    await db.insert(savedReferencesTable).values({
      url,
      caption: null,
      accountName: null,
      whyItsgood: null,
      whatToChange: null,
      howToRemake: null,
      commentsCount: null,
      likeCount: null,
    });
    existingUrls.add(url);
    imported++;
  }

  res.json({ imported, skipped, total: urls.length });
});

export default router;
