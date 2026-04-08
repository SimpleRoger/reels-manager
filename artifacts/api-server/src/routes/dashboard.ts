import { Router, type IRouter } from "express";
import { desc, avg, count, isNotNull } from "drizzle-orm";
import { db, reelsTable, reelNotesTable, reelAnalysisTable, instagramAccountsTable } from "@workspace/db";

const router: IRouter = Router();

router.get("/dashboard/summary", async (req, res): Promise<void> => {
  const [accountRow] = await db.select().from(instagramAccountsTable).limit(1);

  const totalResult = await db.select({ count: count() }).from(reelsTable);
  const totalReels = Number(totalResult[0]?.count ?? 0);

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
  const averages = {
    avgLikes: Number(avgs.avgLikes ?? 0),
    avgComments: Number(avgs.avgComments ?? 0),
    avgReach: avgs.avgReach != null ? Number(avgs.avgReach) : null,
    avgSaves: avgs.avgSaves != null ? Number(avgs.avgSaves) : null,
    avgShares: avgs.avgShares != null ? Number(avgs.avgShares) : null,
  };

  let latestReel = null;
  const latestReels = await db
    .select()
    .from(reelsTable)
    .orderBy(desc(reelsTable.postedAt))
    .limit(1);

  if (latestReels.length > 0) {
    const reel = latestReels[0];
    const [notes] = await db.select().from(reelNotesTable).where(
      (await import("drizzle-orm")).eq(reelNotesTable.reelId, reel.id)
    ).limit(1);
    const [analysis] = await db.select().from(reelAnalysisTable).where(
      (await import("drizzle-orm")).eq(reelAnalysisTable.reelId, reel.id)
    ).limit(1);

    latestReel = {
      ...reel,
      postedAt: reel.postedAt?.toISOString() ?? null,
      createdAt: reel.createdAt.toISOString(),
      updatedAt: reel.updatedAt.toISOString(),
      notes: notes ? {
        ...notes,
        createdAt: notes.createdAt.toISOString(),
        updatedAt: notes.updatedAt.toISOString(),
      } : undefined,
      analysis: analysis ? {
        ...analysis,
        createdAt: analysis.createdAt.toISOString(),
        updatedAt: analysis.updatedAt.toISOString(),
      } : undefined,
    };
  }

  res.json({
    latestReel,
    totalReels,
    averages,
    connected: !!accountRow,
    lastSynced: accountRow?.lastSynced?.toISOString() ?? null,
  });
});

export default router;
