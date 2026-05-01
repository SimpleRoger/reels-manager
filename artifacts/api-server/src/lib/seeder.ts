import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { pool } from "@workspace/db";
import { logger } from "./logger";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Seeds specific tables in production with dev data on first boot.
 * Only runs when REPLIT_DEPLOYMENT is set (Replit production environment).
 * Each table is seeded independently — skipped if it already has rows.
 */
export async function seedProductionIfEmpty(): Promise<void> {
  // REPLIT_DEPLOYMENT is set to "1" in Replit production deployments
  if (!process.env["REPLIT_DEPLOYMENT"]) return;

  // After bundling, __dirname = dist/ — seed file lives one level up at the artifact root
  const seedPath = join(__dirname, "../seed-prod.sql");
  let fullSql: string;
  try {
    fullSql = readFileSync(seedPath, "utf-8");
  } catch (err) {
    logger.error({ err, seedPath }, "seed-prod.sql not found — skipping seed");
    return;
  }

  const client = await pool.connect();
  try {
    // Check each table individually so we can seed whichever ones are empty
    const { rows } = await client.query<{ saved_refs: string; playbook: string }>(`
      SELECT
        (SELECT COUNT(*)::text FROM saved_references) AS saved_refs,
        (SELECT COUNT(*)::text FROM playbook_lessons) AS playbook
    `);
    const savedRefsCount = parseInt(rows[0]?.saved_refs ?? "0", 10);
    const playbookCount = parseInt(rows[0]?.playbook ?? "0", 10);

    if (savedRefsCount > 0 && playbookCount > 0) {
      logger.info({ savedRefsCount, playbookCount }, "Production tables already seeded — skipping");
      return;
    }

    logger.info({ savedRefsCount, playbookCount }, "Production tables empty — applying dev seed");

    await client.query("BEGIN");
    await client.query(fullSql);
    await client.query("COMMIT");

    logger.info("Production seed applied successfully");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    logger.error({ err }, "Failed to apply production seed");
  } finally {
    client.release();
  }
}
