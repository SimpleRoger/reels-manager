import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, playbookLessonsTable } from "@workspace/db";
import {
  CreatePlaybookLessonBody,
  UpdatePlaybookLessonParams,
  UpdatePlaybookLessonBody,
  DeletePlaybookLessonParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

function formatLesson(lesson: typeof playbookLessonsTable.$inferSelect) {
  return {
    ...lesson,
    createdAt: lesson.createdAt.toISOString(),
    updatedAt: lesson.updatedAt.toISOString(),
  };
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
