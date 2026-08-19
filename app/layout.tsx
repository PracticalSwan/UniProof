import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies, headers } from "next/headers";
import Script from "next/script";
import { connection } from "next/server";

import { AuthSessionProvider, type AuthUiState } from "@/components/auth/auth-session-provider";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SavedRestoreProvider } from "@/components/saved/saved-restore-provider";
import { RuntimeStyleNonce } from "@/components/security/runtime-style-nonce";
import { TooltipProvider } from "@/components/ui/tooltip";
import { getPrivateArtifactIdentity, getSsrIdentity } from "@/lib/auth/session";
import { getPublicEnv } from "@/lib/env/public";

import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "UniProof",
    template: "%s | UniProof",
  },
  description:
    "Evidence-first university research, comparison, and application guidance for international students.",
};

async function initialAuthUiState(): Promise<AuthUiState> {
  const env = getPublicEnv();
  if (env.NEXT_PUBLIC_SUPABASE_URL === undefined || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY === undefined) {
    return { status: "signed-out", configured: false };
  }

  try {
    const claimsIdentity = await getSsrIdentity();
    if (claimsIdentity.status === "authenticated") {
      return { status: "signed-in", configured: true, userId: claimsIdentity.userId };
    }
  } catch {
    // Local Supabase can use a signing setup that getClaims cannot verify; fall through to getUser only when an auth token exists.
  }

  const hasAuthTokenCookie = (await cookies()).getAll().some(({ name }) =>
    name.startsWith("sb-") && name.includes("auth-token"),
  );
  if (!hasAuthTokenCookie) return { status: "signed-out", configured: true };

  try {
    const verifiedIdentity = await getPrivateArtifactIdentity();
    return verifiedIdentity.status === "authenticated"
      ? { status: "signed-in", configured: true, userId: verifiedIdentity.userId }
      : { status: "signed-out", configured: true };
  } catch {
    return { status: "signed-out", configured: true };
  }
}

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const nonce = (await headers()).get("x-nonce");
  if (nonce === null || nonce === "") {
    throw new Error("CSP nonce is unavailable for this request.");
  }
  const authState = await initialAuthUiState();

  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Script id="uniproof-zod-jitless" strategy="beforeInteractive" nonce={nonce}>
          {"globalThis.__zod_globalConfig=globalThis.__zod_globalConfig||{};globalThis.__zod_globalConfig.jitless=true;"}
        </Script>
        <RuntimeStyleNonce nonce={nonce} />
        <AuthSessionProvider initialState={authState}>
          <SavedRestoreProvider>
            <TooltipProvider>
              <a
                href="#main-content"
                className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:not-sr-only focus:rounded-md focus:bg-white focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-foreground focus:outline-2 focus:outline-offset-2 focus:outline-ring"
              >
                Skip to main content
              </a>
              <SiteHeader />
              {children}
              <SiteFooter />
            </TooltipProvider>
          </SavedRestoreProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
