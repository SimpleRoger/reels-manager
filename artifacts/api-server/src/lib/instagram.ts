import { logger } from "./logger";

const INSTAGRAM_GRAPH_API = "https://graph.instagram.com/v21.0";

export interface IGMedia {
  id: string;
  media_type: string;
  media_product_type?: string;
  caption?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  timestamp?: string;
  like_count?: number;
  comments_count?: number;
}

export interface IGInsights {
  reach?: number;
  saved?: number;
  shares?: number;
  plays?: number;
  video_views?: number;
}

export async function verifyToken(accessToken: string): Promise<{ id: string; username: string } | null> {
  try {
    const resp = await fetch(
      `${INSTAGRAM_GRAPH_API}/me?fields=id,username&access_token=${accessToken}`
    );
    if (!resp.ok) return null;
    const data = await resp.json() as { id?: string; username?: string; error?: unknown };
    if (!data.id || !data.username) return null;
    return { id: data.id, username: data.username };
  } catch (err) {
    logger.error({ err }, "Error verifying Instagram token");
    return null;
  }
}

export async function fetchUserMedia(accessToken: string, limit = 30): Promise<IGMedia[]> {
  const fields = "id,media_type,media_product_type,caption,permalink,thumbnail_url,media_url,timestamp,like_count,comments_count";
  const url = `${INSTAGRAM_GRAPH_API}/me/media?fields=${fields}&limit=${limit}&access_token=${accessToken}`;
  
  const resp = await fetch(url);
  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Instagram API error: ${err}`);
  }
  
  const data = await resp.json() as { data?: IGMedia[] };
  return data.data ?? [];
}

type InsightMetric = { name: string; value?: number; values?: Array<{ value: number }> };
type InsightResponse = { data?: InsightMetric[]; error?: { message?: string; code?: number } };

// Fetch insights metrics for a media item.
// NOTE: reach/saved/shares/plays all require `instagram_manage_insights` permission.
// The `plays` metric is additionally only available for REELS product type, so we
// try with plays first, then fall back to the other three if plays is rejected.
export async function fetchMediaInsights(mediaId: string, accessToken: string): Promise<IGInsights> {
  const parseMetrics = (metrics: InsightMetric[]): IGInsights => {
    const insights: IGInsights = {};
    for (const m of metrics) {
      const v = m.value ?? m.values?.[0]?.value;
      if (v === undefined) continue;
      if (m.name === "reach") insights.reach = v;
      if (m.name === "saved") insights.saved = v;
      if (m.name === "shares") insights.shares = v;
      if (m.name === "plays") insights.plays = v;
    }
    return insights;
  };

  const fetchMetrics = async (metricList: string): Promise<InsightMetric[] | null> => {
    const url = `${INSTAGRAM_GRAPH_API}/${mediaId}/insights?metric=${metricList}&access_token=${accessToken}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const body = await resp.json().catch(() => ({})) as InsightResponse;
      logger.warn({ mediaId, status: resp.status, metrics: metricList, error: body?.error }, "Insight metrics unavailable");
      return null;
    }
    const data = await resp.json() as InsightResponse;
    return data.data ?? [];
  };

  try {
    // Try full set including plays (only works for REELS media product type)
    const full = await fetchMetrics("reach,saved,shares,plays");
    if (full !== null) return parseMetrics(full);

    // Fallback: plays rejected (non-Reel video) — fetch remaining three metrics
    const basic = await fetchMetrics("reach,saved,shares");
    if (basic !== null) return parseMetrics(basic);

    return {};
  } catch (err) {
    logger.error({ err, mediaId }, "Exception fetching insights");
    return {};
  }
}

export async function searchHashtagMedia(hashtagId: string, accessToken: string, userId: string, limit = 20): Promise<IGMedia[]> {
  const fields = "id,media_type,permalink,caption,comments_count,like_count,timestamp";
  const url = `${INSTAGRAM_GRAPH_API}/${hashtagId}/top_media?user_id=${userId}&fields=${fields}&limit=${limit}&access_token=${accessToken}`;
  
  const resp = await fetch(url);
  if (!resp.ok) return [];
  const data = await resp.json() as { data?: IGMedia[] };
  return data.data ?? [];
}

export async function getHashtagId(hashtag: string, accessToken: string, userId: string): Promise<string | null> {
  const url = `${INSTAGRAM_GRAPH_API}/ig_hashtag_search?user_id=${userId}&q=${encodeURIComponent(hashtag)}&access_token=${accessToken}`;
  
  const resp = await fetch(url);
  if (!resp.ok) return null;
  const data = await resp.json() as { data?: Array<{ id: string }> };
  return data.data?.[0]?.id ?? null;
}

export function computePerformanceStatus(
  reel: { likeCount?: number | null; commentsCount?: number | null; reach?: number | null; saves?: number | null; shares?: number | null },
  averages: { avgLikes: number; avgComments: number; avgReach: number | null; avgSaves: number | null; avgShares: number | null }
): "underperforming" | "normal" | "overperforming" {
  let score = 0;
  let metrics = 0;

  if (reel.likeCount != null && averages.avgLikes > 0) {
    metrics++;
    const ratio = reel.likeCount / averages.avgLikes;
    if (ratio >= 1.5) score++;
    else if (ratio < 0.7) score--;
  }

  if (reel.commentsCount != null && averages.avgComments > 0) {
    metrics++;
    const ratio = reel.commentsCount / averages.avgComments;
    if (ratio >= 2.0) score += 2;
    else if (ratio >= 1.5) score++;
    else if (ratio < 0.7) score--;
  }

  if (reel.reach != null && averages.avgReach && averages.avgReach > 0) {
    metrics++;
    const ratio = reel.reach / averages.avgReach;
    if (ratio >= 1.5) score++;
    else if (ratio < 0.7) score--;
  }

  if (reel.saves != null && averages.avgSaves && averages.avgSaves > 0) {
    metrics++;
    const ratio = reel.saves / averages.avgSaves;
    if (ratio >= 1.5) score++;
    else if (ratio < 0.7) score--;
  }

  if (metrics === 0) return "normal";

  if (score >= 2) return "overperforming";
  if (score <= -1) return "underperforming";
  return "normal";
}
