export type ContentSecurityPolicyInput = {
  nonce: string;
  isDevelopment: boolean;
  requestUrl: string;
  requestHost?: string;
};

const CSP_NONCE = /^[A-Za-z0-9+/_=-]{1,256}$/;

function developmentWebSocketSource(requestUrl: string, requestHost?: string): string | undefined {
  try {
    const parsed = new URL(requestUrl);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
    const host = requestHost?.trim() || parsed.host;
    const hostCheck = new URL(`${parsed.protocol}//${host}`);
    if (hostCheck.host !== host || hostCheck.pathname !== "/" || hostCheck.username !== "" || hostCheck.password !== "") {
      return undefined;
    }
    const socketScheme = parsed.protocol === "https:" ? "wss:" : "ws:";
    return `${socketScheme}//${host}`;
  } catch {
    return undefined;
  }
}

export function buildContentSecurityPolicy(input: ContentSecurityPolicyInput): string {
  if (!CSP_NONCE.test(input.nonce)) {
    throw new Error("CSP nonce contains unsupported characters.");
  }

  const scriptSources = [
    "'self'",
    `'nonce-${input.nonce}'`,
    "'strict-dynamic'",
    ...(input.isDevelopment ? ["'unsafe-eval'"] : []),
  ];
  const styleSources = input.isDevelopment
    ? ["'self'", "'unsafe-inline'"]
    : ["'self'", `'nonce-${input.nonce}'`];
  const websocketSource = input.isDevelopment
    ? developmentWebSocketSource(input.requestUrl, input.requestHost)
    : undefined;
  const connectSources = ["'self'", ...(websocketSource === undefined ? [] : [websocketSource])];

  return [
    "default-src 'self'",
    `script-src ${scriptSources.join(" ")}`,
    "script-src-attr 'none'",
    `style-src-elem ${styleSources.join(" ")}`,
    "style-src-attr 'none'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src ${connectSources.join(" ")}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "frame-src 'none'",
    "media-src 'none'",
    "manifest-src 'self'",
  ].join("; ");
}

export const staticSecurityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "no-referrer" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-DNS-Prefetch-Control", value: "off" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()",
  },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
] as const;
