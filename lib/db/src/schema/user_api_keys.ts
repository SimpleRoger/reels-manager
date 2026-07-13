import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const userApiKeysTable = pgTable("user_api_keys", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  key: text("key").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type UserApiKey = typeof userApiKeysTable.$inferSelect;
