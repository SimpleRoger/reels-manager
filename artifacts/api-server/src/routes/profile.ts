import { Router, type IRouter } from "express";
import { avg, isNotNull, desc } from "drizzle-orm";
import { db, instagramAccountsTable, reelsTable } from "@workspace/db";
import { fetchUserProfile } from "../lib/instagram";

const router: IRouter = Router();

router.get("/profile", async (req, res): Promise<void> => {
  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) {
    res.status(404).json({ error: "No Instagram account connected" });
    return;
  }

  const account = accounts[0];
  const profile = await fetchUserProfile(account.accessToken);

  const avgResult = await db
    .select({
      avgLikes: avg(reelsTable.likeCount),
      avgComments: avg(reelsTable.commentsCount),
      avgReach: avg(reelsTable.reach),
      avgSaves: avg(reelsTable.saves),
      avgShares: avg(reelsTable.shares),
    })
    .from(reelsTable)
    .where(isNotNull(reelsTable.likeCount));

  const avgs = avgResult[0] ?? {};

  const topReels = await db
    .select({
      caption: reelsTable.caption,
      likeCount: reelsTable.likeCount,
      commentsCount: reelsTable.commentsCount,
      reach: reelsTable.reach,
      saves: reelsTable.saves,
      shares: reelsTable.shares,
      performanceStatus: reelsTable.performanceStatus,
    })
    .from(reelsTable)
    .where(isNotNull(reelsTable.reach))
    .orderBy(desc(reelsTable.reach))
    .limit(5);

  const followers = profile?.followersCount ?? null;
  const avgReach = avgs.avgReach != null ? Number(avgs.avgReach) : null;
  const avgLikes = avgs.avgLikes != null ? Number(avgs.avgLikes) : null;
  const avgComments = avgs.avgComments != null ? Number(avgs.avgComments) : null;

  const engagementRate = followers && avgLikes != null && avgComments != null
    ? ((avgLikes + avgComments) / followers) * 100
    : null;

  const reachToFollowerRatio = followers && avgReach
    ? avgReach / followers
    : null;

  res.json({
    username: profile?.username ?? account.username,
    accountType: profile?.accountType ?? null,
    biography: profile?.biography ?? null,
    followersCount: followers,
    mediaCount: profile?.mediaCount ?? null,
    avgReach,
    avgLikes,
    avgComments,
    avgSaves: avgs.avgSaves != null ? Number(avgs.avgSaves) : null,
    avgShares: avgs.avgShares != null ? Number(avgs.avgShares) : null,
    engagementRate,
    reachToFollowerRatio,
    estimatedActiveAudience: avgReach,
    topReels,
  });
});

router.get("/profile/posting-times", async (req, res): Promise<void> => {
  const reels = await db
    .select({
      postedAt: reelsTable.postedAt,
      reach: reelsTable.reach,
      likeCount: reelsTable.likeCount,
      commentsCount: reelsTable.commentsCount,
      plays: reelsTable.plays,
      performanceStatus: reelsTable.performanceStatus,
    })
    .from(reelsTable)
    .where(isNotNull(reelsTable.postedAt));

  // Aggregate by hour (UTC+11 offset for AEDT — Sydney)
  const TZ_OFFSET_HOURS = 11;

  const hourMap = new Map<number, { totalReach: number; totalLikes: number; totalPlays: number; count: number; overperforming: number }>();

  for (let h = 0; h < 24; h++) {
    hourMap.set(h, { totalReach: 0, totalLikes: 0, totalPlays: 0, count: 0, overperforming: 0 });
  }

  for (const reel of reels) {
    if (!reel.postedAt) continue;
    const localHour = (reel.postedAt.getUTCHours() + TZ_OFFSET_HOURS) % 24;
    const entry = hourMap.get(localHour)!;
    entry.count++;
    entry.totalReach += reel.reach ?? 0;
    entry.totalLikes += reel.likeCount ?? 0;
    entry.totalPlays += reel.plays ?? 0;
    if (reel.performanceStatus === "overperforming") entry.overperforming++;
  }

  const hours = Array.from(hourMap.entries()).map(([hour, stats]) => ({
    hour,
    label: formatHourLabel(hour),
    count: stats.count,
    avgReach: stats.count > 0 ? Math.round(stats.totalReach / stats.count) : 0,
    avgLikes: stats.count > 0 ? Math.round(stats.totalLikes / stats.count) : 0,
    avgPlays: stats.count > 0 ? Math.round(stats.totalPlays / stats.count) : 0,
    overperformingCount: stats.overperforming,
  }));

  const withData = hours.filter((h) => h.count > 0);
  const maxReach = Math.max(...withData.map((h) => h.avgReach), 1);

  const bestHour = withData.reduce((best, h) => (h.avgReach > best.avgReach ? h : best), withData[0] ?? hours[0]);

  res.json({ hours, bestHour: bestHour ?? null, totalReels: reels.length });
});

function formatHourLabel(h: number): string {
  if (h === 0) return "12am";
  if (h < 12) return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

router.post("/profile/ai-tips", async (req, res): Promise<void> => {
  const baseUrl = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];

  if (!baseUrl || !apiKey) {
    res.status(500).json({ error: "AI integration not configured" });
    return;
  }

  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) {
    res.status(404).json({ error: "No Instagram account connected" });
    return;
  }

  const account = accounts[0];
  const profile = await fetchUserProfile(account.accessToken);

  const avgResult = await db
    .select({
      avgLikes: avg(reelsTable.likeCount),
      avgComments: avg(reelsTable.commentsCount),
      avgReach: avg(reelsTable.reach),
      avgSaves: avg(reelsTable.saves),
      avgShares: avg(reelsTable.shares),
    })
    .from(reelsTable)
    .where(isNotNull(reelsTable.likeCount));

  const avgs = avgResult[0] ?? {};

  const topReels = await db
    .select({
      caption: reelsTable.caption,
      likeCount: reelsTable.likeCount,
      commentsCount: reelsTable.commentsCount,
      reach: reelsTable.reach,
      saves: reelsTable.saves,
      shares: reelsTable.shares,
      performanceStatus: reelsTable.performanceStatus,
    })
    .from(reelsTable)
    .where(isNotNull(reelsTable.reach))
    .orderBy(desc(reelsTable.reach))
    .limit(5);

  const followers = profile?.followersCount ?? null;
  const avgReach = avgs.avgReach != null ? Number(avgs.avgReach) : null;
  const avgLikes = avgs.avgLikes != null ? Number(avgs.avgLikes) : null;
  const avgComments = avgs.avgComments != null ? Number(avgs.avgComments) : null;
  const engagementRate = followers && avgLikes != null && avgComments != null
    ? (((avgLikes + avgComments) / followers) * 100).toFixed(2)
    : null;

  const topReelSummary = topReels.map((r, i) =>
    `${i + 1}. Caption: "${(r.caption ?? "").slice(0, 100)}" | Reach: ${r.reach} | Likes: ${r.likeCount} | Comments: ${r.commentsCount} | Saves: ${r.saves} | Status: ${r.performanceStatus}`
  ).join("\n");

  const prompt = `You are an expert Instagram growth strategist analyzing a creator's account performance.

Account: @${profile?.username ?? account.username}
Account type: ${profile?.accountType ?? "Unknown"}
Bio: ${profile?.biography ?? "Not set"}
Followers: ${followers ?? "Unknown"}
Total posts: ${profile?.mediaCount ?? "Unknown"}

Performance averages (across their Reels):
- Avg reach per Reel: ${avgReach ?? "N/A"}
- Avg likes per Reel: ${avgLikes ?? "N/A"}
- Avg comments per Reel: ${avgComments ?? "N/A"}
- Avg saves per Reel: ${avgs.avgSaves ? Number(avgs.avgSaves) : "N/A"}
- Avg shares per Reel: ${avgs.avgShares ? Number(avgs.avgShares) : "N/A"}
- Estimated engagement rate: ${engagementRate ? engagementRate + "%" : "N/A"}
- Reach-to-follower ratio: ${avgReach && followers ? (avgReach / followers).toFixed(2) + "x" : "N/A"}

Top performing Reels by reach:
${topReelSummary}

Respond ONLY with a JSON object. All values must be plain readable strings. Use \\n to separate multiple points within a field.

{
  "growthAssessment": "2-3 sentence honest assessment of where the account stands — growth trajectory, strengths, and gaps",
  "profileTips": "3-5 specific tips to improve the profile itself (bio, username, link, highlights, profile photo) — each tip on its own line separated by \\n",
  "contentStrategy": "5 specific content ideas the creator should post next based on what's worked — each idea on its own line separated by \\n. Be concrete, not generic.",
  "followerGrowthTips": "5 actionable tactics to grow followers based on this account's data — each tip on its own line separated by \\n",
  "retentionTips": "3-4 tips to convert reach into followers and saves — each on its own line separated by \\n"
}`;

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 2000,
    }),
  });

  if (!resp.ok) {
    res.status(500).json({ error: "AI request failed" });
    return;
  }

  const data = await resp.json() as { choices: Array<{ message: { content: string } }> };
  const content = data.choices[0]?.message?.content;
  if (!content) {
    res.status(500).json({ error: "No AI response" });
    return;
  }

  let clean = content.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
  }
  const parsed = JSON.parse(clean);
  res.json(parsed);
});

export default router;
