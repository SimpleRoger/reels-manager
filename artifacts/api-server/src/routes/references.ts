import { Router, type IRouter } from "express";
import { eq, desc } from "drizzle-orm";
import { db, savedReferencesTable } from "@workspace/db";
import {
  CreateReferenceBody,
  UpdateReferenceParams,
  UpdateReferenceBody,
  DeleteReferenceParams,
} from "@workspace/api-zod";
import { resolveReelMedia } from "../lib/resolve-reel-video";

const router: IRouter = Router();

function formatReference(ref: typeof savedReferencesTable.$inferSelect) {
  return {
    ...ref,
    createdAt: ref.createdAt.toISOString(),
    updatedAt: ref.updatedAt.toISOString(),
  };
}

router.get("/references", async (_req, res): Promise<void> => {
  const refs = await db
    .select()
    .from(savedReferencesTable)
    .orderBy(desc(savedReferencesTable.commentsCount));
  res.json({ references: refs.map(formatReference) });
});

router.post("/references", async (req, res): Promise<void> => {
  const body = CreateReferenceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  // Try to resolve direct video + thumbnail URLs in the background
  const resolved = await resolveReelMedia(body.data.url);

  const [ref] = await db.insert(savedReferencesTable).values({
    ...body.data,
    mediaUrl: body.data.mediaUrl ?? resolved.mediaUrl,
    thumbnailUrl: body.data.thumbnailUrl ?? resolved.thumbnailUrl,
  }).returning();
  res.status(201).json(formatReference(ref));
});

router.patch("/references/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateReferenceParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateReferenceBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const [ref] = await db
    .update(savedReferencesTable)
    .set(body.data)
    .where(eq(savedReferencesTable.id, params.data.id))
    .returning();

  if (!ref) {
    res.status(404).json({ error: "Reference not found" });
    return;
  }

  res.json(formatReference(ref));
});

router.delete("/references/:id", async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteReferenceParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db.delete(savedReferencesTable).where(eq(savedReferencesTable.id, params.data.id));
  res.sendStatus(204);
});

export default router;
