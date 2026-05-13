import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is required");
  cached = new Anthropic({ apiKey });
  return cached;
}

/** Sonnet for quality work (extraction, tailoring judge). */
export const MODEL_SONNET = "claude-sonnet-4-5";
/** Haiku for cheap high-volume (scoring, classification). */
export const MODEL_HAIKU = "claude-haiku-4-5";
