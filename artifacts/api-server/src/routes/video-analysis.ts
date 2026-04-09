import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, reelsTable, reelVideoAnalysisTable } from "@workspace/db";
import { analyzeReelVideo } from "../lib/gemini";

const router: IRouter = Router();

router.get("/reels/:id/video-analysis", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "0", 10);
  if (!id) { res.status(400).json({ error: "Invalid reel id" }); return; }

  const [existing] = await db
    .select()
    .from(reelVideoAnalysisTable)
    .where(eq(reelVideoAnalysisTable.reelId, id))
    .limit(1);

  if (!existing) { res.status(404).json({ error: "No video analysis found" }); return; }
  res.json(existing);
});

router.post("/reels/:id/video-analyze", async (req, res): Promise<void> => {
  const id = parseInt(req.params["id"] ?? "0", 10);
  if (!id) { res.status(400).json({ error: "Invalid reel id" }); return; }

  const [reel] = await db.select().from(reelsTable).where(eq(reelsTable.id, id)).limit(1);
  if (!reel) { res.status(404).json({ error: "Reel not found" }); return; }

  if (!reel.mediaUrl) {
    res.status(422).json({ error: "This reel has no video URL. Re-sync to refresh CDN links." });
    return;
  }

  let result;
  try {
    result = await analyzeReelVideo(reel.mediaUrl, reel.caption);
  } catch (err: any) {
    req.log.error({ err }, "Gemini video analysis failed");
    res.status(500).json({ error: err?.message ?? "Video analysis failed" });
    return;
  }

  const existing = await db
    .select({ id: reelVideoAnalysisTable.id })
    .from(reelVideoAnalysisTable)
    .where(eq(reelVideoAnalysisTable.reelId, id))
    .limit(1);

  let saved;
  if (existing.length > 0) {
    [saved] = await db
      .update(reelVideoAnalysisTable)
      .set({ ...result })
      .where(eq(reelVideoAnalysisTable.reelId, id))
      .returning();
  } else {
    [saved] = await db
      .insert(reelVideoAnalysisTable)
      .values({ reelId: id, ...result })
      .returning();
  }

  res.json(saved);
});

export default router;
