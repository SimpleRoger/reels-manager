import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, playbookLessonsTable } from "@workspace/db";
import {
  CreatePlaybookLessonBody,
  UpdatePlaybookLessonParams,
  UpdatePlaybookLessonBody,
  DeletePlaybookLessonParams,
} from "@workspace/api-zod";
import { scrapeInstagramReel } from "../lib/apify";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function formatLesson(lesson: typeof playbookLessonsTable.$inferSelect) {
  return {
    ...lesson,
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
  };
}

async function enrichProofUrl(lessonId: number, proofUrl: string): Promise<void> {
  try {
    const result = await scrapeInstagramReel(proofUrl);
    if (!result) return;

    // Check if stats were already pre-filled (e.g. from reel data) — don't overwrite them
    const [existing] = await db
      .select({ proofViewCount: playbookLessonsTable.proofViewCount })
      .from(playbookLessonsTable)
      .where(eq(playbookLessonsTable.id, lessonId));

    if (existing?.proofViewCount != null) {
      // Stats already set — only fill in missing fields like accountName/thumbnailUrl
      await db
        .update(playbookLessonsTable)
        .set({
          proofThumbnailUrl: result.thumbnailUrl ?? undefined,
          proofAccountName: result.accountName ?? undefined,
        })
        .where(eq(playbookLessonsTable.id, lessonId));
      logger.info({ lessonId }, "Proof URL partial-enriched via Apify (stats pre-filled)");
      return;
    }

    await db
      .update(playbookLessonsTable)
      .set({
        proofThumbnailUrl: result.thumbnailUrl ?? undefined,
        proofMediaUrl: result.mediaUrl ?? undefined,
        proofViewCount: result.videoViewCount ?? undefined,
        proofLikeCount: result.likesCount ?? undefined,
        proofCommentsCount: result.commentsCount ?? undefined,
        proofAccountName: result.accountName ?? undefined,
      })
      .where(eq(playbookLessonsTable.id, lessonId));
    logger.info({ lessonId }, "Proof URL enriched via Apify");
  } catch (err) {
    logger.error({ err, lessonId }, "Failed to enrich proof URL");
  }
}

router.get("/playbook", async (_req, res): Promise<void> => {
  const lessons = await db
    .select()
    .from(playbookLessonsTable)
    .orderBy(desc(playbookLessonsTable.createdAt));
  res.json({ lessons: lessons.map(formatLesson) });
});

router.post("/playbook", async (req, res): Promise<void> => {
  const body = CreatePlaybookLessonBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [lesson] = await db.insert(playbookLessonsTable).values(body.data).returning();

  // Fire Apify enrichment in background if proof URL provided
  if (body.data.proofUrl) {
    enrichProofUrl(lesson.id, body.data.proofUrl).catch(() => {});
  }

  res.status(201).json(formatLesson(lesson));
});

router.patch("/playbook/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdatePlaybookLessonParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdatePlaybookLessonBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [lesson] = await db
    .update(playbookLessonsTable)
    .set(body.data)
    .where(eq(playbookLessonsTable.id, params.data.id))
    .returning();

  if (!lesson) {
    res.status(404).json({ error: "Lesson not found" });
    return;
  }

  // If proof URL changed and is new, re-enrich
  if (body.data.proofUrl && body.data.proofUrl !== lesson.proofUrl) {
    enrichProofUrl(lesson.id, body.data.proofUrl).catch(() => {});
  }

  res.json(formatLesson(lesson));
});

router.delete("/playbook/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeletePlaybookLessonParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(playbookLessonsTable).where(eq(playbookLessonsTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
