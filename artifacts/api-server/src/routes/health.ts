import { Router, type IRouter } from "express";
import { asc } from "drizzle-orm";
import { db, instagramAccountsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", async (_req, res) => {
  const accounts = await db
    .select()
    .from(instagramAccountsTable)
    .orderBy(asc(instagramAccountsTable.id));

  const tokenChecks = await Promise.all(
    accounts.map(async (account) => {
      if (!account.accessToken) {
        return { username: account.username, valid: false, error: "No token stored", lastSynced: account.lastSynced?.toISOString() ?? null };
      }

      const token = account.accessToken;
      const base = token.startsWith("IGAA")
        ? "https://graph.instagram.com/v21.0"
        : "https://graph.facebook.com/v21.0";

      const resp = await fetch(`${base}/me?fields=id,username&access_token=${token}`).catch(() => null);
      const body = resp ? await resp.json().catch(() => null) : null;

      if (resp?.ok && body?.id) {
        return { username: account.username, valid: true, error: null, lastSynced: account.lastSynced?.toISOString() ?? null };
      }

      const errorMsg = (body as { error?: { message?: string } } | null)?.error?.message ?? "Unknown error";
      return { username: account.username, valid: false, error: errorMsg, lastSynced: account.lastSynced?.toISOString() ?? null };
    })
  );

  const allValid = tokenChecks.every((t) => t.valid);

  res.json({
    status: allValid ? "ok" : "degraded",
    instagram: tokenChecks,
  });
});

export default router;
