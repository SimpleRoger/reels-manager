import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const reelsTable = pgTable("reels", {
  id: serial("id").primaryKey(),
  instagramId: text("instagram_id").notNull().unique(),
  caption: text("caption"),
  permalink: text("permalink"),
  thumbnailUrl: text("thumbnail_url"),
  mediaUrl: text("media_url"),
  postedAt: timestamp("posted_at", { withTimezone: true }),
  likeCount: integer("like_count"),
  commentsCount: integer("comments_count"),
  reach: integer("reach"),
  saves: integer("saves"),
  shares: integer("shares"),
  plays: integer("plays"),
  performanceStatus: text("performance_status"),
  tags: text("tags").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertReelSchema = createInsertSchema(reelsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertReel = z.infer<typeof insertReelSchema>;
export type Reel = typeof reelsTable.$inferSelect;
