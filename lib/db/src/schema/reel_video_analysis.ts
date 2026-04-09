import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reelsTable } from "./reels";

export const reelVideoAnalysisTable = pgTable("reel_video_analysis", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }).unique(),
  hookRating: text("hook_rating").notNull(),
  hookFeedback: text("hook_feedback").notNull(),
  pacing: text("pacing").notNull(),
  pacingFeedback: text("pacing_feedback").notNull(),
  audio: text("audio").notNull(),
  audioFeedback: text("audio_feedback").notNull(),
  onScreenText: text("on_screen_text").notNull(),
  onScreenTextFeedback: text("on_screen_text_feedback").notNull(),
  contentType: text("content_type").notNull(),
  contentTypeFeedback: text("content_type_feedback").notNull(),
  overallScore: text("overall_score").notNull(),
  suggestions: text("suggestions").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReelVideoAnalysisSchema = createInsertSchema(reelVideoAnalysisTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReelVideoAnalysis = z.infer<typeof insertReelVideoAnalysisSchema>;
export type ReelVideoAnalysis = typeof reelVideoAnalysisTable.$inferSelect;
