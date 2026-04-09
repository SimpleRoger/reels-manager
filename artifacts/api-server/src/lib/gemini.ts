import { logger } from "./logger";

const MAX_INLINE_BYTES = 7.5 * 1024 * 1024; // 7.5 MB — stay under the 8 MB proxy limit

export interface VideoAnalysisResult {
  hookRating: string;
  hookFeedback: string;
  pacing: string;
  pacingFeedback: string;
  audio: string;
  audioFeedback: string;
  onScreenText: string;
  onScreenTextFeedback: string;
  contentType: string;
  contentTypeFeedback: string;
  overallScore: string;
  suggestions: string;
}

async function downloadVideoAsBase64(url: string): Promise<{ data: string; mimeType: string; sizeBytes: number }> {
  const resp = await fetch(url, {
    headers: {
      // Instagram CDN respects these headers — appear as a browser, not a bot
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Accept": "video/mp4,video/*;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Referer": "https://www.instagram.com/",
    },
  });

  if (!resp.ok) {
    throw new Error(`Failed to download video: HTTP ${resp.status}. The CDN URL may have expired — try re-syncing your Instagram account.`);
  }

  const contentType = resp.headers.get("content-type") ?? "video/mp4";
  const mimeType = contentType.split(";")[0]?.trim() ?? "video/mp4";

  const arrayBuffer = await resp.arrayBuffer();
  const sizeBytes = arrayBuffer.byteLength;

  if (sizeBytes === 0) {
    throw new Error("Downloaded video is empty. The CDN URL may have expired — try re-syncing your Instagram account.");
  }

  if (sizeBytes > MAX_INLINE_BYTES) {
    // Trim to the limit — Gemini can still analyse the first portion of the video
    logger.warn({ sizeBytes, limit: MAX_INLINE_BYTES }, "Video exceeds inline limit, trimming to first 7.5 MB");
    const trimmed = arrayBuffer.slice(0, MAX_INLINE_BYTES);
    return { data: Buffer.from(trimmed).toString("base64"), mimeType, sizeBytes };
  }

  return { data: Buffer.from(arrayBuffer).toString("base64"), mimeType, sizeBytes };
}

export async function analyzeReelVideo(mediaUrl: string, caption?: string | null): Promise<VideoAnalysisResult> {
  const baseUrl = process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];

  if (!baseUrl || !apiKey) {
    throw new Error("Gemini AI integration not configured");
  }

  // Step 1: Download the video on our server (Instagram blocks Vertex AI's crawler)
  logger.info({ mediaUrl: mediaUrl.slice(0, 80) }, "Downloading reel for Gemini analysis");
  const { data: videoBase64, mimeType, sizeBytes } = await downloadVideoAsBase64(mediaUrl);
  logger.info({ sizeBytes, mimeType }, "Video downloaded, sending to Gemini");

  const model = "gemini-2.5-flash";
  const apiUrl = `${baseUrl}/models/${model}:generateContent`;

  const prompt = `You are an expert Instagram Reels content strategist and video editor. Watch this Instagram Reel carefully and provide a detailed structured analysis.

Caption: ${caption ?? "(none)"}

Analyse the video across these 5 dimensions and provide an overall score and improvement suggestions.

Respond ONLY with a JSON object. No markdown, no code blocks, just raw JSON.

{
  "hookRating": "Strong / Average / Weak",
  "hookFeedback": "2-3 sentences about the first 3 seconds — what worked or didn't, hook type (visual, audio, text, question, shock), and whether it stops the scroll",
  "pacing": "Fast / Medium / Slow / Mixed",
  "pacingFeedback": "2-3 sentences about edit rhythm, cut frequency, movement, whether pacing matches the content type and holds attention",
  "audio": "Trending Sound / Original Audio / Voiceover / Mixed / Silent",
  "audioFeedback": "2-3 sentences about audio choice, whether it complements the visuals, volume balance, and if it adds to engagement",
  "onScreenText": "Present / Minimal / None",
  "onScreenTextFeedback": "2-3 sentences about text overlays — hook text effectiveness, captions, CTAs, readability, timing on screen",
  "contentType": "e.g. Talking Head / Tutorial / Transition / POV / Vlog / Trend / Comedy / Aesthetic / Storytelling",
  "contentTypeFeedback": "2-3 sentences about how well the content type is executed and whether it matches audience expectations",
  "overallScore": "A score out of 10 with a one-sentence verdict e.g. '7/10 — Strong hook and pacing, but weak CTA and low audio contrast'",
  "suggestions": "5 specific, actionable improvement suggestions, each on its own line separated by \\n. Be concrete about what to change for the next reel."
}`;

  const body = {
    contents: [
      {
        role: "user",
        parts: [
          {
            inlineData: {
              mimeType,
              data: videoBase64,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      maxOutputTokens: 8192,
    },
  };

  const resp = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    logger.error({ status: resp.status, errText: errText.slice(0, 300) }, "Gemini API error");
    throw new Error(`Gemini API error: ${resp.status} — ${errText.slice(0, 200)}`);
  }

  const data = await resp.json() as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    error?: { message: string };
  };

  if (data.error) {
    throw new Error(`Gemini error: ${data.error.message}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("No content from Gemini");

  let clean = text.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
  }

  return JSON.parse(clean) as VideoAnalysisResult;
}
