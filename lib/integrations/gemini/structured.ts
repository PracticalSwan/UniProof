import "server-only";

import { runProviderTransport, boundedJsonObject } from "@/lib/research/ai/structured-task";
import type { StructuredAdapterInput, StructuredProviderResult } from "@/lib/research/ai/types";
import { RESEARCH_AI_MAX_OUTPUT_TOKENS } from "@/lib/security/research-limits";

export const GEMINI_INTERACTIONS_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
export const GEMINI_PRIMARY_MODEL = "gemini-3.5-flash-lite";
export const GEMINI_QUALITY_MODEL = "gemini-3.5-flash";

export type GeminiStructuredMode = "normal" | "quality";

function textFromInteraction(body: Record<string, unknown>): string | undefined {
  for (const value of [body.output_text, body.model_output]) {
    if (typeof value === "string") return value;
  }
  if (!Array.isArray(body.steps)) return undefined;
  for (let index = body.steps.length - 1; index >= 0; index -= 1) {
    const step = boundedJsonObject(body.steps[index]);
    if (step?.type !== "model_output" || !Array.isArray(step.content)) continue;
    const texts = step.content
      .map((part) => boundedJsonObject(part))
      .filter((part): part is Record<string, unknown> => part?.type === "text" && typeof part.text === "string")
      .map((part) => part.text as string);
    if (texts.length > 0) return texts.join("");
  }
  return undefined;
}

function parseGeminiResponse(body: unknown) {
  const object = boundedJsonObject(body);
  if (object === undefined || object.status !== "completed") return { ok: false as const };
  const text = textFromInteraction(object);
  if (text === undefined) return { ok: false as const };
  try {
    return {
      ok: true as const,
      payload: JSON.parse(text) as unknown,
      model: typeof object.model === "string" ? object.model : undefined,
    };
  } catch {
    return { ok: false as const };
  }
}

export async function runGeminiStructuredTask(
  input: StructuredAdapterInput,
  mode: GeminiStructuredMode = "normal",
): Promise<StructuredProviderResult> {
  const model = mode === "quality" ? GEMINI_QUALITY_MODEL : GEMINI_PRIMARY_MODEL;
  const thinkingLevel = mode === "quality" ? "low" : "minimal";
  return runProviderTransport({
    provider: "gemini",
    stage: input.stage ?? input.kind ?? "extraction",
    endpoint: GEMINI_INTERACTIONS_ENDPOINT,
    requestedModel: model,
    headers: {
      "content-type": "application/json",
      "x-goog-api-key": input.apiKey ?? "",
    },
    body: {
      model,
      input: input.prompt,
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: input.schema,
      },
      generation_config: {
        max_output_tokens: RESEARCH_AI_MAX_OUTPUT_TOKENS,
        thinking_level: thinkingLevel,
      },
    },
    parseResponse: parseGeminiResponse,
  }, input);
}

export const runGeminiExtraction = runGeminiStructuredTask;
