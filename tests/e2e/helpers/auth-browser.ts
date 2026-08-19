import { expect, type APIRequestContext, type Page } from "@playwright/test";

const MAILPIT_ORIGIN = "http://127.0.0.1:54324";

export async function clearLocalMailpit(request: APIRequestContext): Promise<void> {
  const response = await request.delete(`${MAILPIT_ORIGIN}/api/v1/messages`);
  expect(response.ok()).toBeTruthy();
}

async function latestMagicLink(request: APIRequestContext): Promise<string | null> {
  const listResponse = await request.get(`${MAILPIT_ORIGIN}/api/v1/messages`);
  if (!listResponse.ok()) return null;
  const list = await listResponse.json() as { messages?: readonly Record<string, unknown>[] };
  const latest = list.messages?.[0];
  if (latest === undefined) return null;
  const id = latest.ID ?? latest.Id ?? latest.id;
  if (typeof id !== "string" || id === "") return null;
  const messageResponse = await request.get(`${MAILPIT_ORIGIN}/api/v1/message/${encodeURIComponent(id)}`);
  if (!messageResponse.ok()) return null;
  const detail = await messageResponse.json() as Record<string, unknown>;
  const text = JSON.stringify(detail);
  const match = /http:\/\/127\.0\.0\.1:3102\/auth\/confirm\?token_hash=[A-Za-z0-9._~-]+(?:&amp;|&)type=email/u.exec(text);
  return match?.[0]?.replace("&amp;", "&") ?? null;
}

export async function signInWithLocalMagicLink(
  page: Page,
  mailpit: APIRequestContext,
  email: string,
): Promise<void> {
  await clearLocalMailpit(mailpit);
  await page.goto("/auth");
  await page.getByLabel("Email address").fill(email);
  await page.getByRole("button", { name: "Send sign-in link" }).click();
  await expect(page.getByText("If this address can receive a UniProof sign-in link")).toBeVisible();

  let link: string | null = null;
  await expect.poll(async () => {
    link = await latestMagicLink(mailpit);
    return link !== null;
  }, { timeout: 10_000 }).toBe(true);
  if (link === null) throw new Error("Local Mailpit did not return a test magic link.");
  await page.goto(link);
  await expect(page).toHaveURL(/\/saved$/u);
  const supabaseCookies = (await page.context().cookies()).filter((cookie) => cookie.name.startsWith("sb-"));
  expect(supabaseCookies.length).toBeGreaterThan(0);
  expect(supabaseCookies.some((cookie) => cookie.name.includes("auth-token"))).toBe(true);
  const privateApi = await page.request.get("/api/saved-artifacts");
  expect(privateApi.status()).toBe(200);
  const sessionResponse = await page.request.get("/api/auth/session");
  expect(sessionResponse.status()).toBe(200);
  const sessionBody = await sessionResponse.json() as { authenticated?: unknown; userId?: unknown };
  expect(sessionBody.authenticated).toBe(true);
  expect(typeof sessionBody.userId).toBe("string");
  const savedHtmlResponse = await page.request.get("/saved");
  expect(savedHtmlResponse.status()).toBe(200);
  expect(await savedHtmlResponse.text()).toContain("Sign out");
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}
