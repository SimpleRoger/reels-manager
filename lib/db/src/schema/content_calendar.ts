import { pgTable, text, serial, timestamp, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const contentCalendarTable = pgTable("content_calendar", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  accountType: text("account_type").notNull().default("ig_reel"),
  status: text("status").notNull().default("idea"),
  scheduledDate: date("scheduled_date").notNull(),
  hook: text("hook"),
  caption: text("caption"),
  outfit: text("outfit"),
  location: text("location"),
  audio: text("audio"),
  notes: text("notes"),
  result: text("result"),
  linkedReelId: integer("linked_reel_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertContentCalendarSchema = createInsertSchema(contentCalendarTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertContentCalendar = z.infer<typeof insertContentCalendarSchema>;
export type ContentCalendar = typeof contentCalendarTable.$inferSelect;
