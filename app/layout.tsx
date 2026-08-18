import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import Script from "next/script";
import { connection } from "next/server";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { RuntimeStyleNonce } from "@/components/security/runtime-style-nonce";
import { TooltipProvider } from "@/components/ui/tooltip";

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

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const nonce = (await headers()).get("x-nonce");
  if (nonce === null || nonce === "") {
    throw new Error("CSP nonce is unavailable for this request.");
  }

  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Script id="uniproof-zod-jitless" strategy="beforeInteractive" nonce={nonce}>
          {"globalThis.__zod_globalConfig=globalThis.__zod_globalConfig||{};globalThis.__zod_globalConfig.jitless=true;"}
        </Script>
        <RuntimeStyleNonce nonce={nonce} />
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
      </body>
    </html>
  );
}
