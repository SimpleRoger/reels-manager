import { pgTable, text, serial, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { reelsTable } from "./reels";

export const reelNotesTable = pgTable("reel_notes", {
  id: serial("id").primaryKey(),
  reelId: integer("reel_id").notNull().references(() => reelsTable.id, { onDelete: "cascade" }).unique(),
  hook: text("hook"),
  format: text("format"),
  ideaSource: text("idea_source"),
  whyItWorked: text("why_it_worked"),
  whyItFailed: text("why_it_failed"),
  emotionalReaction: text("emotional_reaction"),
  contentType: text("content_type"),
  wouldRemake: boolean("would_remake"),
  inspirationLink: text("inspiration_link"),
  extraNotes: text("extra_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReelNotesSchema = createInsertSchema(reelNotesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReelNotes = z.infer<typeof insertReelNotesSchema>;
export type ReelNotes = typeof reelNotesTable.$inferSelect;
