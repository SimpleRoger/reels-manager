import { Router, type IRouter } from "express";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, userApiKeysTable, savedReferencesTable } from "@workspace/db";
import { logger } from "../lib/logger";
import { resolveReelMedia, enrichReferenceWithApify } from "../lib/resolve-reel-video";

const router: IRouter = Router();

function buildJwks() {
  const key = process.env.CLERK_PUBLISHABLE_KEY;
  if (!key) throw new Error("CLERK_PUBLISHABLE_KEY not set");
  const instancePart = key.replace(/^pk_(live|test)_/, "");
  const domain = Buffer.from(instancePart, "base64url").toString("utf-8").replace(/\$+$/, "");
  return createRemoteJWKSet(new URL(`https://${domain}/.well-known/jwks.json`));
}

let _jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks() {
  if (!_jwks) _jwks = buildJwks();
  return _jwks;
}

async function verifyClerkJwt(authHeader: string | undefined): Promise<string | null> {
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const { payload } = await jwtVerify(authHeader.slice(7), getJwks());
    return typeof payload.sub === "string" ? payload.sub : null;
  } catch {
    return null;
  }
}

async function verifyApiKey(header: string | undefined): Promise<string | null> {
  if (!header) return null;
  const [row] = await db.select({ userId: userApiKeysTable.userId })
    .from(userApiKeysTable)
    .where(eq(userApiKeysTable.key, header))
    .limit(1);
  return row?.userId ?? null;
}

// POST /api/user/api-key — get or create a long-lived API key for the authenticated user.
// Called by the mobile app after Clerk sign-in; the key is stored in App Group storage
// so the share extension can read it without needing a live Clerk session.
router.post("/user/api-key", async (req, res): Promise<void> => {
  const userId = await verifyClerkJwt(req.headers.authorization);
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const [existing] = await db.select()
    .from(userApiKeysTable)
    .where(eq(userApiKeysTable.userId, userId))
    .limit(1);

  if (existing) {
    res.json({ key: existing.key });
    return;
  }

  const key = randomBytes(32).toString("hex");
  await db.insert(userApiKeysTable).values({ userId, key });
  logger.info({ userId }, "user/api-key: created");
  res.status(201).json({ key });
});

// POST /api/save — save a URL shared from the iOS share extension.
// Authenticated via X-Api-Key header (long-lived key created by POST /api/user/api-key).
router.post("/save", async (req, res): Promise<void> => {
  const userId = await verifyApiKey(req.headers["x-api-key"] as string | undefined);
  if (!userId) {
    res.status(401).json({ error: "Invalid or missing X-Api-Key" });
    return;
  }

  const { url } = req.body as { url?: string };
  if (!url || typeof url !== "string") {
    res.status(400).json({ error: "url is required" });
    return;
  }

  try {
    const resolved = await resolveReelMedia(url);
    const [ref] = await db
      .insert(savedReferencesTable)
      .values({
        url,
        userId,
        mediaUrl: resolved.mediaUrl ?? null,
        thumbnailUrl: resolved.thumbnailUrl ?? null,
      })
      .returning();

    if (!resolved.mediaUrl) {
      enrichReferenceWithApify(ref.id, url).catch(() => {});
    }

    res.status(201).json({ id: ref.id });
  } catch (err) {
    logger.error({ err, url, userId }, "save: failed");
    res.status(500).json({ error: "Failed to save" });
  }
});

export default router;
