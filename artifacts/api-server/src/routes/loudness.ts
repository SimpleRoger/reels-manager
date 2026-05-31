import { Router, type IRouter } from "express";
import { spawn } from "child_process";
import { createWriteStream, unlink } from "fs";
import { pipeline } from "stream/promises";
import { Readable } from "stream";
import { tmpdir } from "os";
import { join } from "path";
import { randomUUID } from "crypto";
import { eq, isNull } from "drizzle-orm";
import { db, reelsTable } from "@workspace/db";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const USER_AGENT =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1";

interface LufsResult {
  integrated: number;
  range: number;
  truePeak: number | null;
}

function runFfmpegEbur128(filePath: string, timeoutMs: number): Promise<LufsResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", [
      "-i", filePath,
      "-vn",
      "-af", "ebur128=peak=true",
      "-f", "null",
      "-",
    ], { stdio: ["ignore", "ignore", "pipe"] });

    let stderr = "";

    const timer = setTimeout(() => {
      proc.kill("SIGKILL");
      reject(new Error("ffmpeg timed out"));
    }, timeoutMs);

    proc.stderr!.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on("close", (code) => {
      clearTimeout(timer);
      // Parse from the Summary block only (avoids matching per-frame I: values)
      const summaryMatch = stderr.match(/Summary:([\s\S]+)$/);
      const block = summaryMatch?.[1] ?? "";
      const integrated = parseFloat(block.match(/\bI:\s+([-\d.]+)\s+LUFS/)?.[1] ?? "NaN");
      const range      = parseFloat(block.match(/\bLRA:\s+([\d.]+)\s+LU/)?.[1] ?? "NaN");
      const peakMatch  = block.match(/\bPeak:\s+([-\d.]+)\s+dB/);
      const truePeak   = peakMatch ? parseFloat(peakMatch[1]) : null;

      if (isNaN(integrated)) {
        reject(new Error(`ebur128 parse failed (exit ${code}): ${stderr.slice(-400)}`));
        return;
      }
      resolve({ integrated, range, truePeak });
    });

    proc.on("error", (err) => { clearTimeout(timer); reject(err); });
  });
}

async function analyzeUrl(mediaUrl: string, timeoutMs = 180_000): Promise<LufsResult> {
  const tmpFile = join(tmpdir(), `reel_lufs_${randomUUID()}.mp4`);

  try {
    // Download the media with CDN-compatible headers
    const response = await fetch(mediaUrl, {
      headers: { "User-Agent": USER_AGENT },
    });
    if (!response.ok || !response.body) {
      throw new Error(`Media fetch failed: ${response.status}`);
    }

    // Write to temp file so ffmpeg can seek inside the MP4 container
    await pipeline(
      Readable.fromWeb(response.body as import("stream/web").ReadableStream<Uint8Array>),
      createWriteStream(tmpFile),
    );

    return await runFfmpegEbur128(tmpFile, timeoutMs);
  } finally {
    unlink(tmpFile, () => {});
  }
}

// POST /api/reels/:id/loudness
router.post("/reels/:id/loudness", async (req, res): Promise<void> => {
  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) { res.status(400).json({ error: "Invalid reel id" }); return; }

  const [reel] = await db.select().from(reelsTable).where(eq(reelsTable.id, id)).limit(1);
  if (!reel) { res.status(404).json({ error: "Reel not found" }); return; }
  if (!reel.mediaUrl) { res.status(422).json({ error: "Reel has no media URL" }); return; }

  req.log.info({ reelId: id }, "LUFS analysis started");

  let result: LufsResult;
  try {
    result = await analyzeUrl(reel.mediaUrl);
  } catch (err) {
    req.log.error({ reelId: id, err }, "LUFS analysis failed");
    res.status(500).json({ error: "Audio analysis failed" });
    return;
  }

  await db.update(reelsTable).set({
    lufsIntegrated: result.integrated,
    lufsRange: result.range,
    lufsTruePeak: result.truePeak,
    lufsAnalyzedAt: new Date(),
  }).where(eq(reelsTable.id, id));

  req.log.info({ reelId: id, ...result }, "LUFS analysis saved");
  res.json({ reelId: id, integrated: result.integrated, range: result.range, truePeak: result.truePeak, analyzedAt: new Date().toISOString() });
});

// POST /api/reels/loudness-batch
let batchRunning = false;

router.post("/reels/loudness-batch", async (req, res): Promise<void> => {
  if (batchRunning) { res.status(409).json({ error: "Batch already running" }); return; }

  const reels = await db
    .select({ id: reelsTable.id, mediaUrl: reelsTable.mediaUrl })
    .from(reelsTable)
    .where(isNull(reelsTable.lufsAnalyzedAt));

  const pending = reels.filter((r) => r.mediaUrl);

  if (pending.length === 0) {
    res.json({ queued: 0, message: "All reels already analyzed" });
    return;
  }

  res.json({ queued: pending.length, message: `Analyzing ${pending.length} reels in background` });

  batchRunning = true;
  (async () => {
    for (const reel of pending) {
      if (!reel.mediaUrl) continue;
      try {
        const result = await analyzeUrl(reel.mediaUrl);
        await db.update(reelsTable).set({
          lufsIntegrated: result.integrated,
          lufsRange: result.range,
          lufsTruePeak: result.truePeak,
          lufsAnalyzedAt: new Date(),
        }).where(eq(reelsTable.id, reel.id));
        logger.info({ reelId: reel.id, ...result }, "Batch LUFS analysis saved");
      } catch (err) {
        logger.warn({ reelId: reel.id, err }, "Batch LUFS analysis failed for reel");
      }
    }
    batchRunning = false;
    logger.info("LUFS batch analysis complete");
  })();
});

export default router;
