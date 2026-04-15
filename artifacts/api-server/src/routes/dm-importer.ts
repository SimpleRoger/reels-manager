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
  const res = await fetch(url.toString(), {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });
  const data = await res.json() as { error?: { message: string; code: number }; [k: string]: unknown };
  if (!res.ok || data.error) {
    throw new Error(data.error?.message ?? `Instagram API error ${res.status}`);
  }
  return data;
}

// GET /api/dm-importer/conversations — list DM conversations
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
      fields: "id,name,updated_time,participants",
      limit: "20",
    }) as {
      data?: Array<{
        id: string;
        name?: string;
        updated_time: string;
        participants?: { data: Array<{ name: string; id: string }> };
      }>;
    };

    const conversations = (data.data ?? []).map((c) => {
      const participants = c.participants?.data ?? [];
      const otherParticipants = participants.filter((p) => p.id !== accountId);
      const displayName =
        c.name ||
        (otherParticipants.length > 0
          ? otherParticipants.map((p) => p.name).join(", ")
          : "Direct Message");

      return {
        id: c.id,
        name: displayName,
        updatedTime: c.updated_time,
        participantCount: participants.length,
      };
    });

    res.json({ conversations });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    req.log.error({ err }, "Failed to fetch DM conversations");

    if (message.includes("instagram_manage_messages") || message.includes("permission")) {
      res.status(403).json({
        error: "Missing permission",
        details: "Your access token needs the instagram_manage_messages permission. Please follow the steps in Settings to generate a new token with this permission added.",
      });
    } else {
      res.status(500).json({ error: message });
    }
  }
});

// GET /api/dm-importer/conversations/:id/messages — get messages + extract reel URLs
router.get("/dm-importer/conversations/:id/messages", async (req, res): Promise<void> => {
  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) {
    res.status(400).json({ error: "No Instagram account connected" });
    return;
  }

  const { accessToken } = accounts[0];
  const conversationId = req.params["id"];

  try {
    const data = await igGet(`/${conversationId}/messages`, accessToken, {
      fields: "id,message,created_time,from",
      limit: "200",
    }) as {
      data?: Array<{
        id: string;
        message?: string;
        created_time: string;
        from?: { name: string; id: string };
      }>;
    };

    const messages = data.data ?? [];

    // Extract all Instagram reel/post URLs from message text
    const reelUrls: Array<{ url: string; messageId: string; createdTime: string; from?: string }> = [];

    for (const msg of messages) {
      if (!msg.message) continue;
      const matches = msg.message.match(REEL_URL_RE);
      if (matches) {
        for (const url of matches) {
          // Normalise URL — strip tracking params after the shortcode
          const cleanUrl = url.replace(/\?.*$/, "").replace(/\/$/, "");
          reelUrls.push({
            url: cleanUrl,
            messageId: msg.id,
            createdTime: msg.created_time,
            from: msg.from?.name,
          });
        }
      }
    }

    res.json({
      totalMessages: messages.length,
      reelUrls,
    });
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

    const isDuplicate = existingUrls.has(url);

    if (isDuplicate) {
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
    imported++;
  }

  res.json({ imported, skipped, total: urls.length });
});

export default router;
