ALTER TABLE "reels" ADD COLUMN "account_id" integer REFERENCES "instagram_accounts"("id") ON DELETE SET NULL;
UPDATE "reels" SET "account_id" = (SELECT "id" FROM "instagram_accounts" LIMIT 1) WHERE "account_id" IS NULL;
