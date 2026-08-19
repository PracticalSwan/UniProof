import { describe, expect, it } from "vitest";

import { isAllowedSameOriginMutation } from "@/lib/security/same-origin";

function request(url: string, headers: Record<string, string> = {}) {
  return new Request(url, { method: "POST", headers });
}

describe("same-origin mutation guard", () => {
  it("trusts browser-owned same-origin/none Fetch Metadata even when an internal host canonicalization differs", () => {
    expect(isAllowedSameOriginMutation(request("http://localhost:3102/api/auth/sign-out", {
      origin: "http://127.0.0.1:3102",
      "sec-fetch-site": "same-origin",
    }))).toBe(true);
    expect(isAllowedSameOriginMutation(request("http://localhost:3102/api/auth/sign-out", {
      "sec-fetch-site": "none",
    }))).toBe(true);
  });

  it.each(["cross-site", "same-site"])("rejects %s Fetch Metadata regardless of Origin", (fetchSite) => {
    expect(isAllowedSameOriginMutation(request("https://app.example/api/saved-artifacts", {
      origin: "https://app.example",
      "sec-fetch-site": fetchSite,
    }))).toBe(false);
  });

  it("falls back to exact Origin comparison only when Fetch Metadata is absent", () => {
    expect(isAllowedSameOriginMutation(request("https://app.example/api/saved-artifacts", {
      origin: "https://app.example",
    }))).toBe(true);
    expect(isAllowedSameOriginMutation(request("https://app.example/api/saved-artifacts", {
      origin: "https://attacker.example",
    }))).toBe(false);
  });

  it("allows missing Origin only when Fetch Metadata is absent", () => {
    expect(isAllowedSameOriginMutation(request("https://app.example/api/saved-artifacts"))).toBe(true);
    expect(isAllowedSameOriginMutation(request("https://app.example/api/saved-artifacts", {
      "sec-fetch-site": "cross-site",
    }))).toBe(false);
  });
});
