import { Router, type IRouter } from "express";
import { db, instagramAccountsTable, reelsTable } from "@workspace/db";
import { isNotNull } from "drizzle-orm";

const router: IRouter = Router();

function extractHashtags(caption: string | null): string[] {
  if (!caption) return [];
  const matches = caption.match(/#[\w]+/g) ?? [];
  return matches.map((h) => h.toLowerCase());
}

router.get("/viral-finder/hashtags", async (_req, res): Promise<void> => {
  const reels = await db
    .select({
      caption: reelsTable.caption,
      reach: reelsTable.reach,
      likeCount: reelsTable.likeCount,
      commentsCount: reelsTable.commentsCount,
      saves: reelsTable.saves,
      shares: reelsTable.shares,
      plays: reelsTable.plays,
      performanceStatus: reelsTable.performanceStatus,
      permalink: reelsTable.permalink,
    })
    .from(reelsTable)
    .where(isNotNull(reelsTable.caption));

  const tagMap = new Map<string, {
    count: number;
    totalReach: number;
    totalLikes: number;
    totalComments: number;
    overperforming: number;
  }>();

  for (const reel of reels) {
    const tags = extractHashtags(reel.caption);
    for (const tag of tags) {
      const entry = tagMap.get(tag) ?? { count: 0, totalReach: 0, totalLikes: 0, totalComments: 0, overperforming: 0 };
      entry.count++;
      entry.totalReach += reel.reach ?? 0;
      entry.totalLikes += reel.likeCount ?? 0;
      entry.totalComments += reel.commentsCount ?? 0;
      if (reel.performanceStatus === "overperforming") entry.overperforming++;
      tagMap.set(tag, entry);
    }
  }

  const hashtags = Array.from(tagMap.entries())
    .map(([tag, stats]) => ({
      tag,
      count: stats.count,
      avgReach: stats.count > 0 ? Math.round(stats.totalReach / stats.count) : 0,
      avgLikes: stats.count > 0 ? Math.round(stats.totalLikes / stats.count) : 0,
      avgComments: stats.count > 0 ? Math.round(stats.totalComments / stats.count) : 0,
      overperformingCount: stats.overperforming,
    }))
    .filter((h) => h.count >= 1)
    .sort((a, b) => b.avgReach - a.avgReach);

  res.json({ hashtags });
});

router.post("/viral-finder/ai-suggestions", async (req, res): Promise<void> => {
  const baseUrl = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey  = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];

  if (!baseUrl || !apiKey) {
    res.status(500).json({ error: "AI integration not configured" });
    return;
  }

  const accounts = await db.select().from(instagramAccountsTable).limit(1);
  if (accounts.length === 0) {
    res.status(400).json({ error: "No Instagram account connected" });
    return;
  }

  const reels = await db
    .select({
      caption: reelsTable.caption,
      reach: reelsTable.reach,
      performanceStatus: reelsTable.performanceStatus,
    })
    .from(reelsTable)
    .where(isNotNull(reelsTable.caption));

  const tagMap = new Map<string, { count: number; totalReach: number; overperforming: number }>();
  for (const reel of reels) {
    const tags = extractHashtags(reel.caption);
    for (const tag of tags) {
      const entry = tagMap.get(tag) ?? { count: 0, totalReach: 0, overperforming: 0 };
      entry.count++;
      entry.totalReach += reel.reach ?? 0;
      if (reel.performanceStatus === "overperforming") entry.overperforming++;
      tagMap.set(tag, entry);
    }
  }

  const topTags = Array.from(tagMap.entries())
    .map(([tag, s]) => ({ tag, avgReach: s.count > 0 ? Math.round(s.totalReach / s.count) : 0, count: s.count, overperforming: s.overperforming }))
    .sort((a, b) => b.avgReach - a.avgReach)
    .slice(0, 20);

  const topCaptions = reels
    .filter((r) => r.performanceStatus === "overperforming")
    .slice(0, 5)
    .map((r) => `"${(r.caption ?? "").slice(0, 120)}"`)
    .join("\n");

  const prompt = `You are an Instagram hashtag strategist. Analyze this creator's top performing hashtags and overperforming captions. Suggest NEW hashtags they haven't used yet.

Top hashtags by avg reach:
${topTags.map((t) => `${t.tag}: avg reach ${t.avgReach}, used ${t.count}x, overperformed ${t.overperforming}x`).join("\n")}

Sample overperforming captions:
${topCaptions || "None yet"}

Respond ONLY with a JSON object like this (no markdown, no code fences):
{
  "niche": "1-2 sentence analysis of their content niche based on hashtags",
  "strategy": "2-3 sentence hashtag strategy recommendation",
  "newHashtags": "10-15 specific new hashtags they should try, separated by \\n. Mix sizes: some large (1M+ posts), some medium (100K-1M), some niche (<100K). Format each as #hashtag",
  "hashtagsToDropOrReduce": "2-4 hashtags from their current set that are likely too broad or not driving reach, one per line with a brief reason. If none, say 'All current hashtags look strong.'"
}`;

  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 1000,
    }),
  });

  if (!resp.ok) {
    res.status(500).json({ error: "AI request failed" });
    return;
  }

  const aiData = await resp.json() as { choices: Array<{ message: { content: string } }> };
  let content = aiData.choices[0]?.message?.content ?? "";
  if (content.startsWith("```")) {
    content = content.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
  }

  const parsed = JSON.parse(content);
  res.json(parsed);
});

export default router;
