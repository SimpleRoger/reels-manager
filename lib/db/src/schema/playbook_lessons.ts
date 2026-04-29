import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playbookLessonsTable = pgTable("playbook_lessons", {
  id: serial("id").primaryKey(),
  lesson: text("lesson").notNull(),
  category: text("category"),
  sourceReelId: integer("source_reel_id"),
  proofUrl: text("proof_url"),
  proofThumbnailUrl: text("proof_thumbnail_url"),
  proofMediaUrl: text("proof_media_url"),
  proofViewCount: integer("proof_view_count"),
  proofLikeCount: integer("proof_like_count"),
  proofCommentsCount: integer("proof_comments_count"),
  proofAccountName: text("proof_account_name"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlaybookLessonSchema = createInsertSchema(playbookLessonsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlaybookLesson = z.infer<typeof insertPlaybookLessonSchema>;
export type PlaybookLesson = typeof playbookLessonsTable.$inferSelect;
