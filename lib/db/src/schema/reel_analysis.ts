import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reelsTable } from "./reels";

export const reelAnalysisTable = pgTable("reel_analysis", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }).unique(),
  summary: text("summary").notNull(),
  performanceDrivers: text("performance_drivers").notNull(),
  retentionFactors: text("retention_factors").notNull(),
  contentPatterns: text("content_patterns").notNull(),
  lessonsLearned: text("lessons_learned").notNull(),
  nextIdeas: text("next_ideas").notNull(),
  variablesToRepeat: text("variables_to_repeat").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReelAnalysisSchema = createInsertSchema(reelAnalysisTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReelAnalysis = z.infer<typeof insertReelAnalysisSchema>;
export type ReelAnalysis = typeof reelAnalysisTable.$inferSelect;
