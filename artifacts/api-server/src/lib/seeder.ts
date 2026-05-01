import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pool } from "@workspace/db";
import { logger } from "./logger";

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function seedProductionIfEmpty(): Promise<void> {
  if (process.env["NODE_ENV"] !== "production") return;

  const client = await pool.connect();
  try {
    const { rows } = await client.query<{ count: string }>(
      "SELECT COUNT(*)::text AS count FROM reels"
    );
    const count = parseInt(rows[0]?.count ?? "0", 10);

    if (count > 0) {
      logger.info({ count }, "Production DB already seeded — skipping");
      return;
    }

    logger.info("Production DB is empty — applying dev seed");

    // After bundling, __dirname = dist/ — seed file lives one level up at the artifact root
    const seedPath = join(__dirname, "../seed-prod.sql");
    const sql = readFileSync(seedPath, "utf-8");

    await client.query("BEGIN");
    await client.query(sql);
    await client.query("COMMIT");

    logger.info("Production seed applied successfully");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err }, "Failed to apply production seed");
  } finally {
    client.release();
  }
}
