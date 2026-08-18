import type { Page } from "@playwright/test";
import { describe, expect, it } from "vitest";

import { ResearchRouteController } from "@/tests/e2e/helpers/research-browser";
import { succeededAllReadyResponse } from "@/tests/fixtures/research-dossiers";

describe("Phase 3D ResearchRouteController", () => {
  it("fails closed when an expected queued research reply was never consumed", () => {
    const controller = new ResearchRouteController({} as Page);
    controller.enqueueJson(succeededAllReadyResponse);

    expect(() => controller.assertNoQueuedReplies()).toThrow(/unconsumed.*research repl/i);
  });

  it("validates every trusted fixture queue path through the public Research response schema", () => {
    const controller = new ResearchRouteController({} as Page);
    const invalid = { ok: true, data: { unsafe: true } } as never;
    expect(() => controller.enqueueJson(invalid)).toThrow();
    expect(() => controller.enqueueDeferredJson(invalid)).toThrow();
  });
});
