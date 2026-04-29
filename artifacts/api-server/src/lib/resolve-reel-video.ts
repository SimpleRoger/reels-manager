import { db, reelsTable, instagramAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

interface ResolvedMedia {
  mediaUrl: string | null;
  thumbnailUrl: string | null;
}

function extractShortcode(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:reel|p)\/([A-Za-z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function resolveReelMedia(instagramUrl: string): Promise<ResolvedMedia> {
  const shortcode = extractShortcode(instagramUrl);
  if (!shortcode) return { mediaUrl: null, thumbnailUrl: null };

  // First check if this is one of the user's own reels already in the DB
  const ownReels = await db
    .select({ mediaUrl: reelsTable.mediaUrl, thumbnailUrl: reelsTable.thumbnailUrl, permalink: reelsTable.permalink })
    .from(reelsTable)
    .where(eq(reelsTable.permalink, instagramUrl));

  if (!ownReels.length) {
    // Try permalink match without trailing slash variations
    const base = instagramUrl.replace(/\/$/, "");
    const withSlash = base + "/";
    const all = await db.select({ mediaUrl: reelsTable.mediaUrl, thumbnailUrl: reelsTable.thumbnailUrl, permalink: reelsTable.permalink }).from(reelsTable);
    const match = all.find(r => r.permalink && (r.permalink.replace(/\/$/, "") === base));
    if (match) {
      return { mediaUrl: match.mediaUrl ?? null, thumbnailUrl: match.thumbnailUrl ?? null };
    }
  } else {
    return { mediaUrl: ownReels[0].mediaUrl ?? null, thumbnailUrl: ownReels[0].thumbnailUrl ?? null };
  }

  // Try fetching the Instagram page HTML to extract the video URL
  try {
    const res = await fetch(`https://www.instagram.com/reel/${shortcode}/`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!res.ok) {
      logger.warn({ status: res.status, url: instagramUrl }, "resolveReelMedia: page fetch failed");
      return { mediaUrl: null, thumbnailUrl: null };
    }

    const html = await res.text();

    // Extract video_url from page JSON blobs
    const videoMatch = html.match(/"video_url"\s*:\s*"([^"]+)"/);
    const thumbMatch = html.match(/"display_url"\s*:\s*"([^"]+)"/) || html.match(/"thumbnail_src"\s*:\s*"([^"]+)"/);

    const mediaUrl = videoMatch ? videoMatch[1].replace(/\\u0026/g, "&").replace(/\\/g, "") : null;
    const thumbnailUrl = thumbMatch ? thumbMatch[1].replace(/\\u0026/g, "&").replace(/\\/g, "") : null;

    if (mediaUrl) {
      logger.info({ shortcode }, "resolveReelMedia: resolved via page scrape");
    } else {
      logger.info({ shortcode }, "resolveReelMedia: page scraped but no video_url found");
    }

    return { mediaUrl, thumbnailUrl };
  } catch (err) {
    logger.warn({ err, url: instagramUrl }, "resolveReelMedia: scrape error");
    return { mediaUrl: null, thumbnailUrl: null };
  }
}
