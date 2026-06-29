import app from "./app";
import { logger } from "./lib/logger";
import { startAutoSync, scheduleDailySydneySync } from "./lib/sync";
import { enrichMissingReferences } from "./lib/resolve-reel-video";
import { seedProductionIfEmpty } from "./lib/seeder";
import { runMigrations } from "@workspace/db";
import path from "path";

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

// __dirname is injected by the esbuild banner and points to the dist/ directory.
// The build script copies lib/db/drizzle/ → dist/drizzle/ so it's always alongside the bundle.
runMigrations(path.join(__dirname, "drizzle"))
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
