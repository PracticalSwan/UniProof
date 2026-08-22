import { describe, expect, it } from "vitest";

import { GROQ_STRUCTURED_MODEL, runGroqStructuredTask } from "@/lib/integrations/groq/structured";
import { createStructuredProviderHealth } from "@/lib/research/ai/types";
import { portableExtractionJsonSchema } from "@/lib/research/extraction/schema";

function responseBody(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("structured provider health resilience", () => {
  it("does not quarantine transient upstream failures across Research stages", async () => {
    const health = createStructuredProviderHealth();
    let calls = 0;
    const first = await runGroqStructuredTask({
      apiKey: "x",
      prompt: "public extraction task",
      schema: portableExtractionJsonSchema,
      providerHealth: health,
      fetchImpl: async () => {
        calls += 1;
        return new Response("", { status: 503 });
      },
    });

    expect(first).toMatchObject({ ok: false, failureKind: "upstream" });
    expect(health.unavailable.groq).toBeUndefined();

    const second = await runGroqStructuredTask({
      apiKey: "x",
      prompt: "public reconciliation task",
      schema: portableExtractionJsonSchema,
      providerHealth: health,
      stage: "reconciliation",
      fetchImpl: async () => {
        calls += 1;
        return responseBody({
          model: GROQ_STRUCTURED_MODEL,
          choices: [{ message: { content: JSON.stringify({ claims: [] }) } }],
        });
      },
    });

    expect(second).toMatchObject({ ok: true });
    expect(calls).toBe(2);
  });

  it("still quarantines durable in-run rate limits", async () => {
    const health = createStructuredProviderHealth();
    let calls = 0;
    const first = await runGroqStructuredTask({
      apiKey: "x",
      prompt: "public extraction task",
      schema: portableExtractionJsonSchema,
      providerHealth: health,
      fetchImpl: async () => {
        calls += 1;
        return new Response("", { status: 429, headers: { "Retry-After": "60" } });
      },
    });

    expect(first).toMatchObject({ ok: false, failureKind: "rate-limit" });
    expect(health.unavailable.groq).toBe("rate-limit");

    const second = await runGroqStructuredTask({
      apiKey: "x",
      prompt: "public reconciliation task",
      schema: portableExtractionJsonSchema,
      providerHealth: health,
      stage: "reconciliation",
      fetchImpl: async () => {
        calls += 1;
        throw new Error("rate-limited provider must stay quarantined");
      },
    });

    expect(second).toMatchObject({ ok: false, failureKind: "rate-limit" });
    expect(calls).toBe(1);
  });
});
