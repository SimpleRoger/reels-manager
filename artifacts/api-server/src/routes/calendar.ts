import { Router, type IRouter } from "express";
import { eq, and, gte, lte } from "drizzle-orm";
import { db, contentCalendarTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

function formatPost(post: typeof contentCalendarTable.$inferSelect) {
  return {
    ...post,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
  };
}

router.get("/calendar", async (req, res): Promise<void> => {
  const { start, end } = req.query as { start?: string; end?: string };
  const conditions = [];
  if (start) conditions.push(gte(contentCalendarTable.scheduledDate, start));
  if (end) conditions.push(lte(contentCalendarTable.scheduledDate, end));

  const posts = await db
    .select()
    .from(contentCalendarTable)
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(contentCalendarTable.scheduledDate);

  res.json({ posts: posts.map(formatPost) });
});

router.post("/calendar", async (req, res): Promise<void> => {
  const { title, accountType, status, scheduledDate, hook, caption, outfit, location, audio, notes, result, linkedReelId } = req.body as Record<string, string | number | null>;

  if (!title || !scheduledDate) {
    res.status(400).json({ error: "title and scheduledDate are required" });
    return;
  }

  const [post] = await db
    .insert(contentCalendarTable)
    .values({
      title: title as string,
      accountType: (accountType as string) ?? "ig_reel",
      status: (status as string) ?? "idea",
      scheduledDate: scheduledDate as string,
      hook: hook as string | null ?? null,
      caption: caption as string | null ?? null,
      outfit: outfit as string | null ?? null,
      location: location as string | null ?? null,
      audio: audio as string | null ?? null,
      notes: notes as string | null ?? null,
      result: result as string | null ?? null,
      linkedReelId: linkedReelId as number | null ?? null,
    })
    .returning();

  logger.info({ id: post.id }, "Calendar post created");
  res.status(201).json(formatPost(post));
});

router.patch("/calendar/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const { title, accountType, status, scheduledDate, hook, caption, outfit, location, audio, notes, result, linkedReelId } = req.body as Record<string, string | number | null | undefined>;

  const updateData: Partial<typeof contentCalendarTable.$inferInsert> = {};
  if (title !== undefined) updateData.title = title as string;
  if (accountType !== undefined) updateData.accountType = accountType as string;
  if (status !== undefined) updateData.status = status as string;
  if (scheduledDate !== undefined) updateData.scheduledDate = scheduledDate as string;
  if (hook !== undefined) updateData.hook = hook as string | null;
  if (caption !== undefined) updateData.caption = caption as string | null;
  if (outfit !== undefined) updateData.outfit = outfit as string | null;
  if (location !== undefined) updateData.location = location as string | null;
  if (audio !== undefined) updateData.audio = audio as string | null;
  if (notes !== undefined) updateData.notes = notes as string | null;
  if (result !== undefined) updateData.result = result as string | null;
  if (linkedReelId !== undefined) updateData.linkedReelId = linkedReelId as number | null;

  const [post] = await db
    .update(contentCalendarTable)
    .set(updateData)
    .where(eq(contentCalendarTable.id, id))
    .returning();

  if (!post) {
    res.status(404).json({ error: "Post not found" });
    return;
  }

  res.json(formatPost(post));
});

router.delete("/calendar/:id", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id ?? "", 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  await db.delete(contentCalendarTable).where(eq(contentCalendarTable.id, id));
  res.sendStatus(204);
});

export default router;
