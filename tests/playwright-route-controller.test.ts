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
});
