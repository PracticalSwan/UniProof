import "server-only";

import { boundedJsonObject, runProviderTransport } from "@/lib/research/ai/structured-task";
import type { StructuredAdapterInput, StructuredProviderResult } from "@/lib/research/ai/types";
import { RESEARCH_AI_MAX_OUTPUT_TOKENS } from "@/lib/security/research-limits";

export const GROQ_STRUCTURED_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const GROQ_STRUCTURED_MODEL = "openai/gpt-oss-120b";

function parseGroqResponse(body: unknown) {
  const object = boundedJsonObject(body);
  const choices = object?.choices;
  if (object === undefined || !Array.isArray(choices) || choices.length !== 1) return { ok: false as const };
  const choice = boundedJsonObject(choices[0]);
  const message = boundedJsonObject(choice?.message);
  if (message === undefined || typeof message.content !== "string") return { ok: false as const };
  try {
    return {
      ok: true as const,
      payload: JSON.parse(message.content) as unknown,
      model: typeof object.model === "string" ? object.model : undefined,
    };
  } catch {
    return { ok: false as const };
  }
}

export async function runGroqStructuredTask(
  input: StructuredAdapterInput,
): Promise<StructuredProviderResult> {
  return runProviderTransport({
    provider: "groq",
    endpoint: GROQ_STRUCTURED_ENDPOINT,
    requestedModel: GROQ_STRUCTURED_MODEL,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.apiKey ?? ""}`,
    },
    body: {
      model: GROQ_STRUCTURED_MODEL,
      messages: [{ role: "user", content: input.prompt }],
      stream: false,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "uniproof_extraction",
          strict: true,
          schema: input.schema,
        },
      },
      reasoning_effort: "low",
      max_completion_tokens: RESEARCH_AI_MAX_OUTPUT_TOKENS,
    },
    parseResponse: parseGroqResponse,
  }, input);
}

export const runGroqExtraction = runGroqStructuredTask;
