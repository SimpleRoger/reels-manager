import { Router, type IRouter } from "express";
import { eq, avg, isNotNull } from "drizzle-orm";
import { db, reelsTable, reelNotesTable, reelAnalysisTable } from "@workspace/db";
import { AnalyzeReelParams, GetReelAnalysisParams } from "@workspace/api-zod";
import { analyzeReelWithAI } from "../lib/openai";

const router: IRouter = Router();

function formatAnalysis(analysis: typeof reelAnalysisTable.$inferSelect) {
  return {
    ...analysis,
    createdAt: analysis.createdAt.toISOString(),
    updatedAt: analysis.updatedAt.toISOString(),
  };
}

router.post("/reels/:id/analyze", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = AnalyzeReelParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [reel] = await db.select().from(reelsTable).where(eq(reelsTable.id, params.data.id)).limit(1);
  if (!reel) {
    res.status(404).json({ error: "Reel not found" });
    return;
  }

  const [notes] = await db.select().from(reelNotesTable).where(eq(reelNotesTable.reelId, reel.id)).limit(1);

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
  const recentAverages = {
    avgLikes: Number(avgs.avgLikes ?? 0),
    avgComments: Number(avgs.avgComments ?? 0),
    avgReach: avgs.avgReach != null ? Number(avgs.avgReach) : null,
    avgSaves: avgs.avgSaves != null ? Number(avgs.avgSaves) : null,
    avgShares: avgs.avgShares != null ? Number(avgs.avgShares) : null,
  };

  const aiResult = await analyzeReelWithAI({
    caption: reel.caption,
    postedAt: reel.postedAt?.toISOString() ?? null,
    likeCount: reel.likeCount,
    commentsCount: reel.commentsCount,
    reach: reel.reach,
    saves: reel.saves,
    shares: reel.shares,
    plays: reel.plays,
    performanceStatus: reel.performanceStatus,
    notes: notes ?? null,
    recentAverages,
  });

  const existing = await db.select().from(reelAnalysisTable).where(eq(reelAnalysisTable.reelId, reel.id)).limit(1);

  let analysis;
  if (existing.length > 0) {
    [analysis] = await db
      .update(reelAnalysisTable)
      .set(aiResult)
      .where(eq(reelAnalysisTable.reelId, reel.id))
      .returning();
  } else {
    [analysis] = await db
      .insert(reelAnalysisTable)
      .values({ reelId: reel.id, ...aiResult })
      .returning();
  }

  req.log.info({ reelId: reel.id }, "AI analysis complete");
  res.json(formatAnalysis(analysis));
});

router.get("/reels/:id/analysis", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetReelAnalysisParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [analysis] = await db
    .select()
    .from(reelAnalysisTable)
    .where(eq(reelAnalysisTable.reelId, params.data.id))
    .limit(1);

  if (!analysis) {
    res.status(404).json({ error: "No analysis found for this Reel" });
    return;
  }

  res.json(formatAnalysis(analysis));
});

export default router;
