import app from "./app";
import { logger } from "./lib/logger";
import { startAutoSync, scheduleDailySydneySync } from "./lib/sync";
import { enrichMissingReferences } from "./lib/resolve-reel-video";
import { seedProductionIfEmpty } from "./lib/seeder";
import { runMigrations } from "@workspace/db";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

runMigrations()
  .then(() => {
    logger.info("Database migrations applied");
    app.listen(port, (err) => {
      if (err) {
        logger.error({ err }, "Error listening on port");
        process.exit(1);
      }

      logger.info({ port }, "Server listening");
      seedProductionIfEmpty().catch((err) =>
        logger.error({ err }, "seedProductionIfEmpty error")
      );
      startAutoSync();
      scheduleDailySydneySync();
      enrichMissingReferences().catch((err) =>
        logger.error({ err }, "enrichMissingReferences error")
      );
    });
  })
  .catch((err) => {
    logger.error({ err }, "Database migration failed — exiting");
    process.exit(1);
  });
