import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, instagramAccountsTable } from "@workspace/db";

const router: IRouter = Router();

const IG_APP_ID = process.env["INSTAGRAM_APP_ID"]!;
const IG_APP_SECRET = process.env["INSTAGRAM_APP_SECRET"]!;
const REDIRECT_URI = process.env["INSTAGRAM_REDIRECT_URI"]!;
const FRONTEND_URL = process.env["FRONTEND_URL"] ?? "https://workspacereel-journal-production.up.railway.app";

// Step 1 — redirect user to Instagram OAuth
router.get("/auth/instagram", (_req, res): void => {
  const params = new URLSearchParams({
    enable_fb_login: "0",
    force_authentication: "1",
    client_id: IG_APP_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "instagram_basic,instagram_manage_insights",
  });
  res.redirect(`https://www.instagram.com/oauth/authorize?${params}`);
});

// Step 2 — Instagram redirects back here with ?code=...
router.get("/auth/instagram/callback", async (req, res): Promise<void> => {
  const code = req.query["code"] as string | undefined;

  if (!code) {
    res.redirect(`${FRONTEND_URL}/settings?error=instagram_auth_failed`);
    return;
  }

  try {
    // Exchange code for short-lived token
    const tokenRes = await fetch("https://api.instagram.com/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: IG_APP_ID,
        client_secret: IG_APP_SECRET,
        grant_type: "authorization_code",
        redirect_uri: REDIRECT_URI,
        code,
      }),
    });

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      req.log.error({ err }, "Instagram token exchange failed");
      res.redirect(`${FRONTEND_URL}/settings?error=token_exchange_failed`);
      return;
    }

    const tokenData = await tokenRes.json() as { access_token?: string; user_id?: number; error_message?: string };

    if (!tokenData.access_token || !tokenData.user_id) {
      req.log.error({ tokenData }, "Instagram token exchange returned no token");
      res.redirect(`${FRONTEND_URL}/settings?error=token_exchange_failed`);
      return;
    }

    // Exchange short-lived token for long-lived token (60 days)
    const longLivedRes = await fetch(
      `https://graph.instagram.com/access_token?grant_type=ig_exchange_token&client_secret=${IG_APP_SECRET}&access_token=${tokenData.access_token}`
    );

    let finalToken = tokenData.access_token;
    if (longLivedRes.ok) {
      const llData = await longLivedRes.json() as { access_token?: string };
      if (llData.access_token) finalToken = llData.access_token;
    }

    // Fetch the Instagram username
    const userRes = await fetch(
      `https://graph.instagram.com/v21.0/me?fields=id,username&access_token=${finalToken}`
    );

    if (!userRes.ok) {
      req.log.error("Failed to fetch Instagram user info after OAuth");
      res.redirect(`${FRONTEND_URL}/settings?error=user_fetch_failed`);
      return;
    }

    const userData = await userRes.json() as { id?: string; username?: string };
    const accountId = userData.id ?? String(tokenData.user_id);
    const username = userData.username ?? String(tokenData.user_id);

    // Upsert by accountId — update token if account already exists, insert if new
    const existing = await db
      .select()
      .from(instagramAccountsTable)
      .where(eq(instagramAccountsTable.accountId, accountId))
      .limit(1);
    if (existing.length > 0) {
      await db
        .update(instagramAccountsTable)
        .set({ username, accessToken: finalToken })
        .where(eq(instagramAccountsTable.id, existing[0].id));
    } else {
      await db.insert(instagramAccountsTable).values({ accountId, username, accessToken: finalToken });
    }

    req.log.info({ username, accountId }, "Instagram OAuth connected");
    res.redirect(`${FRONTEND_URL}/settings?connected=true`);
  } catch (err) {
    req.log.error({ err }, "Instagram OAuth callback error");
    res.redirect(`${FRONTEND_URL}/settings?error=unknown`);
  }
});

export default router;
