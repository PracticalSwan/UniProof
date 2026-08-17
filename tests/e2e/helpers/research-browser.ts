import {
  expect,
  test as base,
  type BrowserContext,
  type ConsoleMessage,
  type Page,
  type Request,
  type Route,
} from "@playwright/test";

import type { ResearchModeResponse } from "@/lib/research/mode/public-contracts";
import { fixtureTarget } from "@/tests/fixtures/research-dossiers";

export type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T | PromiseLike<T>) => void;
  reject: (reason?: unknown) => void;
};

export function deferred<T>(): Deferred<T> {
  let resolve!: Deferred<T>["resolve"];
  let reject!: Deferred<T>["reject"];
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

export type CapturedResearchRequest = {
  method: string;
  url: string;
  body: unknown;
};

type FulfillReply = {
  kind: "fulfill";
  status: number;
  contentType?: string;
  headers?: Record<string, string>;
  body: string;
};

type AbortReply = { kind: "abort"; errorCode?: "failed" | "connectionreset" };
type ResearchReply = FulfillReply | AbortReply;

type QueuedResearchReply = {
  reply: ResearchReply;
  entered?: Deferred<CapturedResearchRequest>;
  release?: Deferred<void>;
};

export type DeferredResearchReply = {
  entered: Promise<CapturedResearchRequest>;
  release: () => void;
};

function bodyAsJson(value: unknown): string {
  return JSON.stringify(value);
}

export class ResearchRouteController {
  readonly requests: CapturedResearchRequest[] = [];
  readonly unexpectedRequests: CapturedResearchRequest[] = [];
  private readonly queue: QueuedResearchReply[] = [];
  private readonly pendingReleases = new Set<Deferred<void>>();
  private installed = false;

  constructor(
    private readonly page: Page,
    private readonly audit?: BrowserAudit,
  ) {}

  async install(): Promise<void> {
    if (this.installed) return;
    this.installed = true;
    await this.page.route("**/api/research", this.handleRoute);
  }

  enqueueJson(
    response: ResearchModeResponse,
    status = 200,
    contentType = "application/json; charset=utf-8",
  ): void {
    this.enqueueUnvalidatedJson(response, status, contentType);
  }

  enqueueUnvalidatedJson(
    response: unknown,
    status = 200,
    contentType = "application/json; charset=utf-8",
  ): void {
    this.queue.push({
      reply: { kind: "fulfill", status, contentType, body: bodyAsJson(response) },
    });
  }

  enqueueRaw(
    body: string,
    options: {
      status?: number;
      contentType?: string | null;
      headers?: Record<string, string>;
    } = {},
  ): void {
    this.queue.push({
      reply: {
        kind: "fulfill",
        status: options.status ?? 200,
        ...(options.contentType === null ? {} : {
          contentType: options.contentType ?? "application/json; charset=utf-8",
        }),
        ...(options.headers === undefined ? {} : { headers: options.headers }),
        body,
      },
    });
  }

  enqueueRedirect(location: string, status = 302): void {
    if (this.audit !== undefined) this.audit.expectedRedirectFailureLocations.push(location);
    this.queue.push({
      reply: {
        kind: "fulfill",
        status,
        headers: { location },
        body: "",
      },
    });
  }

  enqueueAbort(errorCode: AbortReply["errorCode"] = "failed"): void {
    if (this.audit !== undefined) this.audit.expectedResearchNetworkFailures += 1;
    this.queue.push({ reply: { kind: "abort", errorCode } });
  }

  enqueueDeferredJson(
    response: ResearchModeResponse,
    options: { status?: number; contentType?: string } = {},
  ): DeferredResearchReply {
    const entered = deferred<CapturedResearchRequest>();
    const release = deferred<void>();
    this.pendingReleases.add(release);
    this.queue.push({
      reply: {
        kind: "fulfill",
        status: options.status ?? 200,
        contentType: options.contentType ?? "application/json; charset=utf-8",
        body: bodyAsJson(response),
      },
      entered,
      release,
    });
    return {
      entered: entered.promise,
      release: () => release.resolve(),
    };
  }

  enqueueDeferredRaw(
    body: string,
    options: { status?: number; contentType?: string } = {},
  ): DeferredResearchReply {
    const entered = deferred<CapturedResearchRequest>();
    const release = deferred<void>();
    this.pendingReleases.add(release);
    this.queue.push({
      reply: {
        kind: "fulfill",
        status: options.status ?? 200,
        contentType: options.contentType ?? "application/json; charset=utf-8",
        body,
      },
      entered,
      release,
    });
    return {
      entered: entered.promise,
      release: () => release.resolve(),
    };
  }

  async dispose(): Promise<void> {
    for (const release of this.pendingReleases) release.resolve();
    this.pendingReleases.clear();
    if (this.installed) {
      await this.page.unroute("**/api/research", this.handleRoute);
      this.installed = false;
    }
  }

  assertNoQueuedReplies(): void {
    if (this.queue.length !== 0) {
      throw new Error(`${this.queue.length} unconsumed expected research ${this.queue.length === 1 ? "reply" : "replies"} remained at test teardown.`);
    }
  }

  private readonly handleRoute = async (route: Route, request: Request): Promise<void> => {
    let body: unknown;
    const raw = request.postData();
    try {
      body = raw === null ? undefined : JSON.parse(raw);
    } catch {
      body = raw;
    }
    const captured: CapturedResearchRequest = {
      method: request.method(),
      url: request.url(),
      body,
    };
    this.requests.push(captured);

    const queued = this.queue.shift();
    if (queued === undefined) {
      this.unexpectedRequests.push(captured);
      await route.abort("failed");
      return;
    }

    queued.entered?.resolve(captured);
    if (queued.release !== undefined) {
      await queued.release.promise;
      this.pendingReleases.delete(queued.release);
    }

    try {
      if (queued.reply.kind === "abort") {
        await route.abort(queued.reply.errorCode ?? "failed");
        return;
      }
      if (
        this.audit !== undefined &&
        (queued.reply.status < 200 || queued.reply.status >= 300) &&
        queued.reply.headers?.location === undefined
      ) {
        this.audit.expectedResearchHttpFailures += 1;
      }
      await route.fulfill({
        status: queued.reply.status,
        ...(queued.reply.contentType === undefined
          ? { headers: queued.reply.headers ?? {} }
          : {
              contentType: queued.reply.contentType,
              headers: queued.reply.headers,
            }),
        body: queued.reply.body,
      });
    } catch (error) {
      if (!request.isNavigationRequest() && request.failure() !== null) return;
      throw error;
    }
  };
}

type BrowserAudit = {
  externalRequests: string[];
  pageErrors: string[];
  consoleErrors: string[];
  dialogs: string[];
  popups: string[];
  expectedResearchHttpFailures: number;
  consumedResearchHttpFailures: number;
  expectedResearchNetworkFailures: number;
  consumedResearchNetworkFailures: number;
  expectedRedirectFailureLocations: string[];
};

function createBrowserAudit(): BrowserAudit {
  return {
    externalRequests: [],
    pageErrors: [],
    consoleErrors: [],
    dialogs: [],
    popups: [],
    expectedResearchHttpFailures: 0,
    consumedResearchHttpFailures: 0,
    expectedResearchNetworkFailures: 0,
    consumedResearchNetworkFailures: 0,
    expectedRedirectFailureLocations: [],
  };
}

function isAllowedBrowserUrl(url: string, allowedOrigin: string): boolean {
  if (url.startsWith("data:") || url.startsWith("blob:")) return true;
  try {
    const parsed = new URL(url);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      parsed.origin === allowedOrigin;
  } catch {
    return false;
  }
}

function isResearchHttpFailure(message: ConsoleMessage, allowedOrigin: string): boolean {
  if (!message.text().startsWith("Failed to load resource: the server responded with a status of")) {
    return false;
  }
  const locationUrl = message.location().url;
  if (locationUrl === "") return false;
  try {
    const parsed = new URL(locationUrl);
    return parsed.origin === allowedOrigin && parsed.pathname === "/api/research";
  } catch {
    return false;
  }
}

async function installBrowserAudit(
  page: Page,
  context: BrowserContext,
  baseURL: string,
  audit: BrowserAudit,
): Promise<() => Promise<void>> {
  const allowedOrigin = new URL(baseURL).origin;
  const guard = async (route: Route): Promise<void> => {
    const url = route.request().url();
    if (isAllowedBrowserUrl(url, allowedOrigin)) {
      await route.continue();
      return;
    }
    audit.externalRequests.push(url);
    await route.abort("blockedbyclient");
  };
  await context.route("**/*", guard);

  page.on("pageerror", (error) => audit.pageErrors.push(error.message));
  page.on("console", (message) => {
    if (message.type() !== "error") return;
    if (
      isResearchHttpFailure(message, allowedOrigin) &&
      audit.consumedResearchHttpFailures < audit.expectedResearchHttpFailures
    ) {
      audit.consumedResearchHttpFailures += 1;
      return;
    }
    if (message.text() === "Failed to load resource: net::ERR_FAILED") {
      const locationUrl = message.location().url;
      try {
        const parsed = new URL(locationUrl);
        if (
          parsed.origin === allowedOrigin &&
          parsed.pathname === "/api/research" &&
          audit.consumedResearchNetworkFailures < audit.expectedResearchNetworkFailures
        ) {
          audit.consumedResearchNetworkFailures += 1;
          return;
        }
        const redirectIndex = audit.expectedRedirectFailureLocations.indexOf(locationUrl);
        if (redirectIndex !== -1) {
          audit.expectedRedirectFailureLocations.splice(redirectIndex, 1);
          return;
        }
      } catch {
        // Fall through so malformed/unrelated console locations fail closed.
      }
    }
    audit.consoleErrors.push(`${message.location().url} ${message.text()}`.trim());
  });
  page.on("dialog", (dialog) => {
    audit.dialogs.push(`${dialog.type()}:${dialog.message()}`);
    void dialog.dismiss();
  });
  page.on("popup", (popup) => {
    audit.popups.push(popup.url());
    void popup.close();
  });

  return async () => {
    await context.unroute("**/*", guard);
  };
}

type Phase3Fixtures = {
  audit: BrowserAudit;
  research: ResearchRouteController;
};

export const test = base.extend<Phase3Fixtures>({
  audit: [async ({ page, context, baseURL }, use) => {
    if (baseURL === undefined) throw new Error("Phase 3 E2E requires Playwright baseURL");
    const audit = createBrowserAudit();
    const cleanup = await installBrowserAudit(page, context, baseURL, audit);
    await use(audit);
    await cleanup();
    expect(audit.externalRequests, "unexpected external browser HTTP(S) requests").toEqual([]);
    expect(audit.pageErrors, "unexpected page errors").toEqual([]);
    expect(audit.consoleErrors, "unexpected application console errors").toEqual([]);
    expect(
      audit.consumedResearchHttpFailures,
      "each intentional non-2xx /api/research console failure must be consumed exactly once",
    ).toBe(audit.expectedResearchHttpFailures);
    expect(
      audit.consumedResearchNetworkFailures,
      "each intentional aborted /api/research console failure must be consumed exactly once",
    ).toBe(audit.expectedResearchNetworkFailures);
    expect(audit.expectedRedirectFailureLocations, "intentional redirect console failures must be consumed exactly").toEqual([]);
    expect(audit.dialogs, "unexpected JavaScript dialogs").toEqual([]);
    expect(audit.popups, "unexpected popups/windows").toEqual([]);
  }, { auto: true }],
  research: [async ({ page, audit }, use) => {
    void audit;
    const controller = new ResearchRouteController(page, audit);
    await controller.install();
    await use(controller);
    await controller.dispose();
    controller.assertNoQueuedReplies();
    expect(controller.unexpectedRequests, "unexpected /api/research request without queued fixture").toEqual([]);
  }, { auto: true }],
});

export { expect } from "@playwright/test";

export async function openResearch(page: Page): Promise<void> {
  await page.goto("/research");
  await expect(page.getByRole("heading", { level: 1, name: "Research a university or program." })).toBeVisible();
}

export async function selectFixtureProgram(page: Page): Promise<void> {
  const search = page.getByLabel("Search supported universities and programs");
  await search.fill("MIT");
  await page.getByRole("button", { name: new RegExp(programButtonPattern()) }).click();
  await expect(page.getByText(fixtureTarget.program.name, { exact: false }).last()).toBeVisible();
}

export async function selectFixtureUniversity(page: Page): Promise<void> {
  const search = page.getByLabel("Search supported universities and programs");
  await search.fill("MIT");
  await page.getByRole("button", { name: /Massachusetts Institute of Technology.*University research/ }).click();
}

function programButtonPattern(): string {
  return fixtureTarget.program.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function submitResearch(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Research", exact: true }).click();
}

export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
}

export function expectPublicRequestShape(body: unknown): asserts body is Record<string, unknown> {
  expect(body).toBeTruthy();
  expect(typeof body).toBe("object");
  const keys = Object.keys(body as Record<string, unknown>).sort();
  const allowed = ["academicYear", "categories", "intake", "programId", "question", "universityId"];
  expect(keys.every((key) => allowed.includes(key))).toBe(true);
}

export async function expectSafeExternalLink(
  page: Page,
  name: string | RegExp,
  expectedHref: string,
): Promise<void> {
  const link = page.getByRole("link", { name });
  await expect(link).toHaveAttribute("href", expectedHref);
  await expect(link).toHaveAttribute("target", "_blank");
  await expect(link).toHaveAttribute("rel", "noopener noreferrer");
  await expect(link).toHaveAttribute("referrerpolicy", "no-referrer");
}
