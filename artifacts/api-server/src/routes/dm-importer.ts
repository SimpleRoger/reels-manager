import { Router, type IRouter } from "express";
import { db, instagramAccountsTable, savedReferencesTable } from "@workspace/db";

const router: IRouter = Router();

const GRAPH_BASE = "https://graph.instagram.com/v21.0";

// Regex to find Instagram reel/post URLs in message text
const REEL_URL_RE = /https?:\/\/(?:www\.)?instagram\.com\/(?:reel|p)\/[\w-]+\/?(?:\?[^\s]*)*/gi;

async function igGet(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`${GRAPH_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  // Support both query param and Authorization header — try header first (new API)
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString());
  const data = await res.json() as { error?: { message: string; code: number; type?: string }; [k: string]: unknown };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Instagram API error ${res.status}`);
  }
  return data;
}

// GET /api/dm-importer/debug — raw Instagram API response for debugging
router.get("/dm-importer/debug", async (req, res): Promise<void> => {
  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) { res.status(400).json({ error: "No account" }); return; }
  const { accessToken, accountId } = accounts[0];

  const results: Record<string, unknown> = {};

  // Step 1: Get linked Facebook Pages (needed to get Page access token)
  const fbBase = "https://graph.facebook.com/v21.0";
  try {
    const meUrl = new URL(`${fbBase}/me`);
    meUrl.searchParams.set("fields", "id,name,accounts");
    meUrl.searchParams.set("access_token", accessToken);
    const meRes = await fetch(meUrl.toString());
    results["fb_me"] = await meRes.json();
  } catch (e) { results["fb_me"] = { fetchError: String(e) }; }

  // Step 2: Try /me/conversations on graph.facebook.com
  for (const platform of ["instagram", "messenger"]) {
    try {
      const url = new URL(`${fbBase}/me/conversations`);
      url.searchParams.set("platform", platform);
      url.searchParams.set("access_token", accessToken);
      url.searchParams.set("limit", "5");
      const r = await fetch(url.toString());
      results[`fb_me_conversations?platform=${platform}`] = await r.json();
    } catch (e) { results[`fb_me_conversations?platform=${platform}`] = { fetchError: String(e) }; }
  }

  // Step 3: Try with Instagram account ID on graph.facebook.com
  for (const platform of ["instagram"]) {
    try {
      const url = new URL(`${fbBase}/${accountId}/conversations`);
      url.searchParams.set("platform", platform);
      url.searchParams.set("access_token", accessToken);
      url.searchParams.set("limit", "5");
      const r = await fetch(url.toString());
      results[`fb_accountId_conversations?platform=${platform}`] = await r.json();
    } catch (e) { results[`fb_accountId_conversations?platform=${platform}`] = { fetchError: String(e) }; }
  }

  res.json(results);
});

// GET /api/dm-importer/conversations — list DM conversations
// API: GET /me/conversations?platform=instagram
router.get("/dm-importer/conversations", async (req, res): Promise<void> => {
  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) {
    res.status(400).json({ error: "No Instagram account connected" });
    return;
  }

  const { accessToken } = accounts[0];

  try {
    const data = await igGet(`/me/conversations`, accessToken, {
      platform: "instagram",
      limit: "20",
    }) as {
      data?: Array<{ id: string; updated_time: string }>;
    };

    const conversations = (data.data ?? []).map((c) => ({
      id: c.id,
      name: `Conversation ${c.id.slice(-6)}`,
      updatedTime: c.updated_time,
    }));

    res.json({ conversations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Failed to fetch DM conversations");

    if (
      message.toLowerCase().includes("permission") ||
      message.toLowerCase().includes("instagram_business_manage_messages") ||
      message.toLowerCase().includes("instagram_manage_messages") ||
      message.includes("OAuthException") ||
      message.includes("190") ||
      message.includes("200")
    ) {
      res.status(403).json({
        error: "Missing permission",
        details: "Your access token needs the instagram_business_manage_messages permission. Please generate a new token in Graph API Explorer with this permission checked, then update it in Settings.",
      });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

// GET /api/dm-importer/conversations/:id/messages
// Step 1: GET /<CONVERSATION_ID>?fields=messages → get list of message IDs
// Step 2: GET /<MESSAGE_ID>?fields=id,created_time,from,to,message → get content for each (max 20)
router.get("/dm-importer/conversations/:id/messages", async (req, res): Promise<void> => {
  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) {
    res.status(400).json({ error: "No Instagram account connected" });
    return;
  }

  const { accessToken } = accounts[0];
  const conversationId = req.params["id"];

  try {
    // Step 1: get message IDs from the conversation
    const convoData = await igGet(`/${conversationId}`, accessToken, {
      fields: "messages",
    }) as {
      messages?: {
        data: Array<{ id: string; created_time: string }>;
      };
      id?: string;
    };

    const messageIds = convoData.messages?.data ?? [];

    // Step 2: fetch content for each message (API only supports last 20)
    const reelUrls: Array<{ url: string; messageId: string; createdTime: string; from?: string }> = [];
    let totalMessages = messageIds.length;

    await Promise.all(
      messageIds.map(async (msg) => {
        try {
          const msgData = await igGet(`/${msg.id}`, accessToken, {
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
          // Individual message fetch can fail if message is older than 20 — skip it
        }
      })
    );

    // Sort by most recent first
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

  // Fetch all existing URLs once upfront to avoid N+1 queries
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
    existingUrls.add(url); // prevent duplicates within the same import batch
    imported++;
  }

  res.json({ imported, skipped, total: urls.length });
});

export default router;
