import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const savedReferencesTable = pgTable("saved_references", {
  id: serial("id").primaryKey(),
  url: text("url").notNull(),
  caption: text("caption"),
  accountName: text("account_name"),
  whyItsgood: text("why_its_good"),
  whatToChange: text("what_to_change"),
  howToRemake: text("how_to_remake"),
  commentsCount: integer("comments_count"),
  likeCount: integer("like_count"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertSavedReferenceSchema = createInsertSchema(savedReferencesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertSavedReference = z.infer<typeof insertSavedReferenceSchema>;
export type SavedReference = typeof savedReferencesTable.$inferSelect;
