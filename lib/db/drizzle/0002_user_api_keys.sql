CREATE TABLE "user_api_keys" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "key" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "user_api_keys_user_id_idx" ON "user_api_keys" ("user_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "user_api_keys_key_idx" ON "user_api_keys" ("key");
--> statement-breakpoint
ALTER TABLE "saved_references" ADD COLUMN "user_id" text;
