import { logger } from "./logger";

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

export async function analyzeReelVideo(mediaUrl: string, caption?: string | null): Promise<VideoAnalysisResult> {
  const baseUrl = process.env["AI_INTEGRATIONS_GEMINI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_GEMINI_API_KEY"];

  if (!baseUrl || !apiKey) {
    throw new Error("Gemini AI integration not configured");
  }

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
            fileData: {
              mimeType: "video/mp4",
              fileUri: mediaUrl,
            },
          },
          {
            text: prompt,
          },
        ],
      },
    ],
    generationConfig: {
      responseMimeType: "application/json",
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
    logger.error({ status: resp.status, errText }, "Gemini API error");
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
