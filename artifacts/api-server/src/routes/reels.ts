import { Router, type IRouter } from "express";
import { eq, desc, asc, sql, count } from "drizzle-orm";
import { db, reelsTable, reelNotesTable, reelAnalysisTable } from "@workspace/db";
import {
  GetReelParams,
  GetReelNotesParams,
  SaveReelNotesParams,
  SaveReelNotesBody,
  UpdateReelTagsParams,
  UpdateReelTagsBody,
  ListReelsQueryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatReel(reel: typeof reelsTable.$inferSelect) {
  return {
    ...reel,
    postedAt: reel.postedAt?.toISOString() ?? null,
    createdAt: reel.createdAt.toISOString(),
    updatedAt: reel.updatedAt.toISOString(),
  };
}

function formatNotes(notes: typeof reelNotesTable.$inferSelect) {
  return {
    ...notes,
    createdAt: notes.createdAt.toISOString(),
    updatedAt: notes.updatedAt.toISOString(),
  };
}

function formatAnalysis(analysis: typeof reelAnalysisTable.$inferSelect) {
  return {
    ...analysis,
    createdAt: analysis.createdAt.toISOString(),
    updatedAt: analysis.updatedAt.toISOString(),
  };
}

router.get("/reels", async (req, res): Promise<void> => {
  const query = ListReelsQueryParams.safeParse(req.query);
  if (!query.success) {
    res.status(400).json({ error: query.error.message });
    return;
  }

  const { sortBy = "createdAt", sortOrder = "desc", limit = 20, offset = 0, tags } = query.data;

  const columnMap: Record<string, typeof reelsTable.createdAt> = {
    createdAt: reelsTable.createdAt,
    postedAt: reelsTable.postedAt as unknown as typeof reelsTable.createdAt,
    likeCount: reelsTable.likeCount as unknown as typeof reelsTable.createdAt,
    commentsCount: reelsTable.commentsCount as unknown as typeof reelsTable.createdAt,
    reach: reelsTable.reach as unknown as typeof reelsTable.createdAt,
    saves: reelsTable.saves as unknown as typeof reelsTable.createdAt,
    shares: reelsTable.shares as unknown as typeof reelsTable.createdAt,
  };

  const sortColumn = columnMap[sortBy] ?? reelsTable.postedAt;
  const orderFn = sortOrder === "asc" ? asc : desc;

  let baseQuery = db.select().from(reelsTable).$dynamic();

  if (tags) {
    const tagList = tags.split(",").map((t) => t.trim()).filter(Boolean);
    if (tagList.length > 0) {
      baseQuery = baseQuery.where(
        sql`${reelsTable.tags} && ARRAY[${sql.join(tagList.map(t => sql`${t}`), sql`, `)}]::text[]`
      );
    }
  }

  const reels = await baseQuery.orderBy(orderFn(sortColumn)).limit(limit).offset(offset);

  const totalResult = await db.select({ count: count() }).from(reelsTable);
  const total = Number(totalResult[0]?.count ?? 0);

  res.json({ reels: reels.map(formatReel), total });
});

router.get("/reels/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetReelParams.safeParse({ id: parseInt(raw, 10) });
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
  const [analysis] = await db.select().from(reelAnalysisTable).where(eq(reelAnalysisTable.reelId, reel.id)).limit(1);

  res.json({
    ...formatReel(reel),
    notes: notes ? formatNotes(notes) : null,
    analysis: analysis ? formatAnalysis(analysis) : null,
  });
});

router.get("/reels/:id/notes", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetReelNotesParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [reel] = await db.select().from(reelsTable).where(eq(reelsTable.id, params.data.id)).limit(1);
  if (!reel) {
    res.status(404).json({ error: "Reel not found" });
    return;
  }

  const [notes] = await db.select().from(reelNotesTable).where(eq(reelNotesTable.reelId, params.data.id)).limit(1);
  if (!notes) {
    res.status(404).json({ error: "No notes found for this Reel" });
    return;
  }

  res.json(formatNotes(notes));
});

router.put("/reels/:id/notes", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = SaveReelNotesParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = SaveReelNotesBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [reel] = await db.select().from(reelsTable).where(eq(reelsTable.id, params.data.id)).limit(1);
  if (!reel) {
    res.status(404).json({ error: "Reel not found" });
    return;
  }

  const existing = await db.select().from(reelNotesTable).where(eq(reelNotesTable.reelId, params.data.id)).limit(1);

  let notes;
  if (existing.length > 0) {
    [notes] = await db
      .update(reelNotesTable)
      .set(body.data)
      .where(eq(reelNotesTable.reelId, params.data.id))
      .returning();
  } else {
    [notes] = await db
      .insert(reelNotesTable)
      .values({ reelId: params.data.id, ...body.data })
      .returning();
  }

  res.json(formatNotes(notes));
});

router.put("/reels/:id/tags", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateReelTagsParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateReelTagsBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [reel] = await db.select().from(reelsTable).where(eq(reelsTable.id, params.data.id)).limit(1);
  if (!reel) {
    res.status(404).json({ error: "Reel not found" });
    return;
  }

  await db.update(reelsTable).set({ tags: body.data.tags }).where(eq(reelsTable.id, params.data.id));
  res.json({ tags: body.data.tags });
});

export default router;
