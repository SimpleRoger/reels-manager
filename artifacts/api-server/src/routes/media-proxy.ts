import { Router, type IRouter } from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

const ALLOWED_HOSTS = [
  "scontent.cdninstagram.com",
  "cdninstagram.com",
  "fbcdn.net",
  "scontent-",          // prefix match for regional CDN hosts
  "instagram.f",        // e.g. instagram.fxxx1-1.fna.fbcdn.net
  "video.cdninstagram",
];

function isAllowed(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return ALLOWED_HOSTS.some((h) => host.includes(h));
  } catch {
    return false;
  }
}

// GET /api/media-proxy?url=<encoded_url>
// Proxies a media resource (video/image) from Instagram CDN, stripping CORP headers
// so the browser can load it cross-origin and draw it to a canvas.
router.get("/media-proxy", async (req, res): Promise<void> => {
  const rawUrl = req.query["url"];
  if (typeof rawUrl !== "string" || !rawUrl) {
    res.status(400).json({ error: "url query param required" });
    return;
  }

  let targetUrl: string;
  try {
    targetUrl = decodeURIComponent(rawUrl);
  } catch {
    res.status(400).json({ error: "Invalid url encoding" });
    return;
  }

  if (!isAllowed(targetUrl)) {
    res.status(403).json({ error: "URL not allowed" });
    return;
  }

  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1",
  };

  // Forward Range header for video seeking
  if (req.headers["range"]) {
    headers["Range"] = req.headers["range"] as string;
  }

  let upstream: Response;
  try {
    upstream = await fetch(targetUrl, { headers });
  } catch (err) {
    logger.warn({ targetUrl, err }, "Media proxy fetch failed");
    res.status(502).json({ error: "Failed to fetch media" });
    return;
  }

  logger.info(
    { status: upstream.status, targetHost: new URL(targetUrl).hostname },
    "Media proxy upstream response"
  );

  // Forward status (206 for range requests, 200 otherwise)
  res.status(upstream.status);

  // Forward useful headers, strip CORP/CORS restrictions
  const passThrough = [
    "content-type",
    "content-length",
    "content-range",
    "accept-ranges",
    "cache-control",
    "last-modified",
    "etag",
  ];
  for (const h of passThrough) {
    const v = upstream.headers.get(h);
    if (v) res.setHeader(h, v);
  }

  // Allow cross-origin access
  res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
  res.setHeader("Access-Control-Allow-Origin", "*");

  if (!upstream.body) {
    res.end();
    return;
  }

  // Stream body to client
  const reader = upstream.body.getReader();
  const flush = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) { res.end(); break; }
      if (!res.write(value)) {
        await new Promise<void>((r) => res.once("drain", r));
      }
    }
  };

  flush().catch((err) => {
    logger.warn({ err }, "Media proxy stream error");
    res.end();
  });
});

export default router;
