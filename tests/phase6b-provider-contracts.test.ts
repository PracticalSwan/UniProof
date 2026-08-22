import { describe, expect, it } from "vitest";

import {
  GEMINI_INTERACTIONS_ENDPOINT,
  GEMINI_PRIMARY_MODEL,
  GEMINI_QUALITY_MODEL,
  runGeminiStructuredTask,
} from "@/lib/integrations/gemini/structured";
import {
  GROQ_STRUCTURED_MODEL,
  runGroqStructuredTask,
} from "@/lib/integrations/groq/structured";
import {
  OPENROUTER_FREE_MODEL,
  runOpenRouterStructuredTask,
} from "@/lib/integrations/openrouter/structured";
import {
  searchBrave,
} from "@/lib/integrations/brave/search";
import {
  searchTavily,
} from "@/lib/integrations/tavily/search";
import { portableExtractionJsonSchema } from "@/lib/research/extraction/schema";

const query = {
  id: "query-admissions",
  kind: "category" as const,
  text: "Example University admissions requirements",
  category: "admissions" as const,
  maxResults: 3,
  target: {
    universityName: "Example University",
    officialHost: "example.edu",
  },
};

function successfulGeminiBody(text: string) {
  return {
    status: "completed",
    model: GEMINI_PRIMARY_MODEL,
    output_text: text,
    steps: [{
      type: "model_output",
      content: [{ type: "text", text }],
    }],
  };
}

describe("Gemini stable v1 contract", () => {
  it("uses exactly the stable v1 Interactions endpoint without changing schema or privacy controls", async () => {
    expect(GEMINI_INTERACTIONS_ENDPOINT).toBe("https://generativelanguage.googleapis.com/v1/interactions");

    let observedUrl = "";
    let observedInit: RequestInit | undefined;
    const result = await runGeminiStructuredTask({
      apiKey: "synthetic-gemini-key",
      prompt: "public source material",
      schema: portableExtractionJsonSchema,
      fetchImpl: async (input, init) => {
        observedUrl = String(input);
        observedInit = init;
        return new Response(JSON.stringify(successfulGeminiBody(JSON.stringify({ claims: [] }))), {
          headers: { "content-type": "application/json" },
        });
      },
    });

    expect(observedUrl).toBe(GEMINI_INTERACTIONS_ENDPOINT);
    const body = JSON.parse(String(observedInit?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: GEMINI_PRIMARY_MODEL,
      input: "public source material",
      store: false,
      response_format: {
        type: "text",
        mime_type: "application/json",
        schema: portableExtractionJsonSchema,
      },
      generation_config: {
        max_output_tokens: 1_500,
        thinking_level: "minimal",
      },
    });
    expect(body).not.toHaveProperty("tools");
    expect(result).toMatchObject({ ok: true, provider: "gemini", model: GEMINI_PRIMARY_MODEL });
    expect(GEMINI_QUALITY_MODEL).toBe("gemini-3.5-flash");
  });
});

describe("search provider privacy and capability contract", () => {
  it("sends only Tavily's bounded basic search request and does not persist raw response material", async () => {
    let observedUrl = "";
    let observedInit: RequestInit | undefined;
    const result = await searchTavily(query, {
      apiKey: "synthetic-tavily-key",
      fetchImpl: async (input, init) => {
        observedUrl = String(input);
        observedInit = init;
        return new Response(JSON.stringify({
          answer: "model answer must not become evidence",
          raw_content: "raw provider content must not become evidence",
          results: [{
            url: "https://example.edu/admissions",
            title: "Official admissions page",
            score: 0.9,
            raw_content: "provider raw content marker",
          }],
        }), { headers: { "content-type": "application/json" } });
      },
    });

    expect(observedUrl).toBe("https://api.tavily.com/search");
    expect(observedInit?.headers).toMatchObject({ Authorization: "Bearer synthetic-tavily-key" });
    expect(JSON.parse(String(observedInit?.body))).toEqual({
      query: query.text,
      search_depth: "basic",
      include_answer: false,
      include_raw_content: false,
      auto_parameters: false,
      max_results: 3,
    });
    expect(result).toMatchObject({ outcome: "success", retryCount: 0 });
    expect(result.candidates).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("model answer must not become evidence");
    expect(JSON.stringify(result)).not.toContain("raw provider content");
  });

  it("uses Brave URL/title/rank discovery only and omits raw snippets from promoted candidates", async () => {
    let observedUrl = "";
    let observedInit: RequestInit | undefined;
    const result = await searchBrave(query, {
      apiKey: "synthetic-brave-key",
      fetchImpl: async (input, init) => {
        observedUrl = String(input);
        observedInit = init;
        return new Response(JSON.stringify({
          web: {
            results: [{
              url: "https://example.edu/admissions",
              title: "Official admissions page",
              description: "Brave result snippet must not be persisted",
            }],
          },
        }), { headers: { "content-type": "application/json" } });
      },
    });

    const url = new URL(observedUrl);
    expect(url.origin + url.pathname).toBe("https://api.search.brave.com/res/v1/web/search");
    expect(url.searchParams.get("q")).toBe(query.text);
    expect(url.searchParams.get("count")).toBe("3");
    expect(observedInit?.headers).toMatchObject({ "X-Subscription-Token": "synthetic-brave-key" });
    expect(result).toMatchObject({ outcome: "success", retryCount: 0 });
    expect(result.candidates).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain("Brave result snippet");
  });
});

describe("structured AI provider contract", () => {
  it("keeps Groq non-streaming strict JSON Schema with the reviewed model", async () => {
    let observedInit: RequestInit | undefined;
    const result = await runGroqStructuredTask({
      apiKey: "synthetic-groq-key",
      prompt: "public source material",
      schema: portableExtractionJsonSchema,
      fetchImpl: async (_input, init) => {
        observedInit = init;
        return new Response(JSON.stringify({
          model: GROQ_STRUCTURED_MODEL,
          choices: [{ message: { content: JSON.stringify({ claims: [] }) } }],
        }), { headers: { "content-type": "application/json" } });
      },
    });

    const body = JSON.parse(String(observedInit?.body)) as Record<string, unknown>;
    expect(body).toMatchObject({
      model: GROQ_STRUCTURED_MODEL,
      stream: false,
      reasoning_effort: "low",
      max_completion_tokens: 1_500,
    });
    expect(body.response_format).toMatchObject({ type: "json_schema" });
    expect(result).toMatchObject({ ok: true, model: GROQ_STRUCTURED_MODEL });
  });

  it("keeps OpenRouter parameters and concrete routed-model requirements", async () => {
    const bodies: unknown[] = [];
    const run = async (requireZdr: boolean) => runOpenRouterStructuredTask({
      apiKey: "synthetic-openrouter-key",
      prompt: "public source material",
      schema: portableExtractionJsonSchema,
      requireOpenRouterZdr: requireZdr,
      fetchImpl: async (_input, init) => {
        bodies.push(JSON.parse(String(init?.body)));
        return new Response(JSON.stringify({
          model: requireZdr ? "zdr-provider/model" : "standard-provider/model",
          choices: [{ message: { content: JSON.stringify({ claims: [] }) } }],
        }), { headers: { "content-type": "application/json" } });
      },
    });

    const standard = await run(false);
    const zdr = await run(true);

    expect(bodies[0]).toMatchObject({
      model: OPENROUTER_FREE_MODEL,
      stream: false,
      provider: { require_parameters: true, data_collection: "deny" },
    });
    expect((bodies[0] as { provider?: Record<string, unknown> }).provider).not.toHaveProperty("zdr");
    expect(bodies[1]).toMatchObject({
      provider: { require_parameters: true, data_collection: "deny", zdr: true },
    });
    expect(standard).toMatchObject({ ok: true, model: "standard-provider/model" });
    expect(zdr).toMatchObject({ ok: true, model: "zdr-provider/model" });
  });

  it("stops structured AI retry waits immediately on terminal signal", async () => {
    const caller = new AbortController();
    let calls = 0;
    const pending = runGroqStructuredTask({
      apiKey: "synthetic-groq-key",
      prompt: "public source material",
      schema: portableExtractionJsonSchema,
      signal: caller.signal,
      sleep: () => new Promise<void>(() => undefined),
      fetchImpl: async () => {
        calls += 1;
        return new Response("", { status: 429, headers: { "retry-after": "1" } });
      },
    });
    await Promise.resolve();
    caller.abort();
    const outcome = await Promise.race([
      pending.then((value) => ({ value })),
      new Promise<{ timeout: true }>((resolve) => setTimeout(() => resolve({ timeout: true }), 0)),
    ]);
    expect(outcome).toEqual({
      value: expect.objectContaining({ ok: false, aborted: true }),
    });
    expect(calls).toBe(1);
  });

  it("reserves no second provider/fallback attempt when abort happens in backoff", async () => {
    const caller = new AbortController();
    let calls = 0;
    const result = await runGroqStructuredTask({
      apiKey: "synthetic-groq-key",
      prompt: "public source material",
      schema: portableExtractionJsonSchema,
      signal: caller.signal,
      sleep: async () => {
        caller.abort();
      },
      fetchImpl: async () => {
        calls += 1;
        return new Response("", { status: 503 });
      },
    });
    expect(result).toMatchObject({ ok: false, aborted: true });
    expect(calls).toBe(1);
  });

  it("reports cancellation during a pending structured AI body read without leaking body content", async () => {
    const caller = new AbortController();
    let bodyCancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start() {
        // Deliberately never enqueue a complete JSON body.
      },
      cancel() {
        bodyCancelled = true;
      },
    });
    const pending = runGroqStructuredTask({
      apiKey: "synthetic-groq-key",
      prompt: "public source material",
      schema: portableExtractionJsonSchema,
      signal: caller.signal,
      fetchImpl: async () => new Response(stream, {
        headers: { "content-type": "application/json" },
      }),
    });
    await Promise.resolve();
    caller.abort();
    const result = await pending;
    expect(result).toMatchObject({ ok: false, aborted: true });
    expect(bodyCancelled).toBe(true);
  });
});
