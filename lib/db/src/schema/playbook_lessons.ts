import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playbookLessonsTable = pgTable("playbook_lessons", {
  id: serial("id").primaryKey(),
  lesson: text("lesson").notNull(),
  category: text("category"),
  sourceReelId: integer("source_reel_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPlaybookLessonSchema = createInsertSchema(playbookLessonsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlaybookLesson = z.infer<typeof insertPlaybookLessonSchema>;
export type PlaybookLesson = typeof playbookLessonsTable.$inferSelect;
