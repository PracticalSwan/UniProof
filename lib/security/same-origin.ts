export function isAllowedSameOriginMutation(request: Pick<Request, "headers" | "url">): boolean {
  const fetchSite = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (fetchSite === "same-origin" || fetchSite === "none") return true;
  if (fetchSite !== undefined) return false;

  const origin = request.headers.get("origin");
  if (origin === null) return true;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}
