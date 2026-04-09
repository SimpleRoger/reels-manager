import { logger } from "./logger";

interface ReelForAnalysis {
  caption?: string | null;
  postedAt?: string | null;
  likeCount?: number | null;
  commentsCount?: number | null;
  reach?: number | null;
  saves?: number | null;
  shares?: number | null;
  plays?: number | null;
  performanceStatus?: string | null;
  notes?: {
    hook?: string | null;
    format?: string | null;
    ideaSource?: string | null;
    whyItWorked?: string | null;
    whyItFailed?: string | null;
    emotionalReaction?: string | null;
    contentType?: string | null;
    wouldRemake?: boolean | null;
    inspirationLink?: string | null;
    extraNotes?: string | null;
  } | null;
  recentAverages?: {
    avgLikes: number;
    avgComments: number;
    avgReach?: number | null;
    avgSaves?: number | null;
    avgShares?: number | null;
  };
}

export interface AIAnalysisResult {
  summary: string;
  performanceDrivers: string;
  retentionFactors: string;
  contentPatterns: string;
  lessonsLearned: string;
  nextIdeas: string;
  variablesToRepeat: string;
}

export async function analyzeReelWithAI(reel: ReelForAnalysis): Promise<AIAnalysisResult> {
  const baseUrl = process.env["AI_INTEGRATIONS_OPENAI_BASE_URL"];
  const apiKey = process.env["AI_INTEGRATIONS_OPENAI_API_KEY"];

  if (!baseUrl || !apiKey) {
    throw new Error("AI integration not configured");
  }

  const apiUrl = `${baseUrl}/chat/completions`;

  const prompt = `You are a professional Instagram content strategist analyzing a Reel's performance for a creator.

Reel data:
- Caption: ${reel.caption ?? "None"}
- Posted at: ${reel.postedAt ?? "Unknown"}
- Performance status: ${reel.performanceStatus ?? "Unknown"}
- Likes: ${reel.likeCount ?? "N/A"}
- Comments: ${reel.commentsCount ?? "N/A"}
- Reach: ${reel.reach ?? "N/A"}
- Saves: ${reel.saves ?? "N/A"}
- Shares: ${reel.shares ?? "N/A"}
- Plays: ${reel.plays ?? "N/A"}

Recent account averages:
- Avg likes: ${reel.recentAverages?.avgLikes ?? "N/A"}
- Avg comments: ${reel.recentAverages?.avgComments ?? "N/A"}
- Avg reach: ${reel.recentAverages?.avgReach ?? "N/A"}
- Avg saves: ${reel.recentAverages?.avgSaves ?? "N/A"}
- Avg shares: ${reel.recentAverages?.avgShares ?? "N/A"}

Creator notes:
- Hook: ${reel.notes?.hook ?? "Not recorded"}
- Format: ${reel.notes?.format ?? "Not recorded"}
- Idea source: ${reel.notes?.ideaSource ?? "Not recorded"}
- Why creator thinks it worked: ${reel.notes?.whyItWorked ?? "Not recorded"}
- Why creator thinks it flopped: ${reel.notes?.whyItFailed ?? "Not recorded"}
- Emotional reaction from viewers: ${reel.notes?.emotionalReaction ?? "Not recorded"}
- Content type: ${reel.notes?.contentType ?? "Not recorded"}
- Would remake: ${reel.notes?.wouldRemake == null ? "Unknown" : reel.notes.wouldRemake ? "Yes" : "No"}
- Extra notes: ${reel.notes?.extraNotes ?? "None"}

Respond ONLY with a JSON object in this exact structure (no markdown, no code blocks, just raw JSON).
ALL values must be plain readable strings — no nested objects, no arrays, no JSON inside the values.
Use line breaks (\\n) to separate multiple points within a single field.

{
  "summary": "2-3 sentence summary of what happened with this Reel and its overall performance",
  "performanceDrivers": "Plain text explanation of what drove (or hurt) engagement. Cover what the data shows and what may have contributed contextually. Write it as flowing prose or use short lines separated by \\n.",
  "retentionFactors": "Plain text explanation of what likely drove people to watch, save, or share — factors affecting retention and stickiness",
  "contentPatterns": "Plain text summary of content and format patterns — hook style, pacing, topic, emotion, controversy, novelty, relatability",
  "lessonsLearned": "3-5 actionable lessons, each on its own line separated by \\n. No bullets, no numbers, just plain lines.",
  "nextIdeas": "5 specific content ideas, each on its own line separated by \\n. Be concrete. No bullets, no numbers.",
  "variablesToRepeat": "List the key elements to repeat, each on its own line separated by \\n. No bullets, no numbers."
}`;

  const resp = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 1500,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    logger.error({ status: resp.status, errText }, "OpenAI API error");
    throw new Error(`OpenAI API error: ${resp.status}`);
  }

  const data = await resp.json() as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content;
  if (!content) throw new Error("No content from OpenAI");

  let clean = content.trim();
  if (clean.startsWith("```")) {
    clean = clean.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "").trim();
  }
  const parsed = JSON.parse(clean) as AIAnalysisResult;
  return parsed;
}
