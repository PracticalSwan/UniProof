import "server-only";

import { boundedJsonObject, runProviderTransport } from "@/lib/research/ai/structured-task";
import type { StructuredAdapterInput, StructuredProviderResult } from "@/lib/research/ai/types";
import { RESEARCH_AI_MAX_OUTPUT_TOKENS } from "@/lib/security/research-limits";

export const OPENROUTER_STRUCTURED_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
export const OPENROUTER_FREE_MODEL = "openrouter/free";

function parseOpenRouterResponse(body: unknown) {
  const object = boundedJsonObject(body);
  const choices = object?.choices;
  const model = typeof object?.model === "string" ? object.model.trim() : "";
  if (
    object === undefined ||
    !Array.isArray(choices) ||
    choices.length !== 1 ||
    model === "" ||
    model === OPENROUTER_FREE_MODEL
  ) return { ok: false as const };
  const choice = boundedJsonObject(choices[0]);
  const message = boundedJsonObject(choice?.message);
  if (message === undefined || typeof message.content !== "string") return { ok: false as const };
  try {
    return {
      ok: true as const,
      payload: JSON.parse(message.content) as unknown,
      model,
    };
  } catch {
    return { ok: false as const };
  }
}

export async function runOpenRouterStructuredTask(
  input: StructuredAdapterInput,
): Promise<StructuredProviderResult> {
  const provider: Record<string, unknown> = {
    require_parameters: true,
    data_collection: "deny",
  };
  if (input.requireOpenRouterZdr === true) provider.zdr = true;
  return runProviderTransport({
    provider: "openrouter",
    endpoint: OPENROUTER_STRUCTURED_ENDPOINT,
    requestedModel: OPENROUTER_FREE_MODEL,
    requireConcreteModel: true,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${input.apiKey ?? ""}`,
    },
    body: {
      model: OPENROUTER_FREE_MODEL,
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
      provider,
      max_tokens: RESEARCH_AI_MAX_OUTPUT_TOKENS,
    },
    parseResponse: parseOpenRouterResponse,
  }, input);
}

export const runOpenRouterExtraction = runOpenRouterStructuredTask;
