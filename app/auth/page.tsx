import type { Metadata } from "next";

import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to save private UniProof research and planning snapshots.",
};

export default function AuthPage() {
  return (
    <main id="main-content" className="mx-auto w-full max-w-2xl px-5 py-12 sm:px-8 lg:py-16">
      <section aria-labelledby="auth-heading">
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-primary">Optional account</p>
        <h1 id="auth-heading" className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Sign in to save private snapshots</h1>
        <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
          Research, Compare, and Guide work without an account. Sign in only if you want to save private snapshots for later use.
        </p>
        <div className="mt-8 rounded-xl border border-border bg-card p-5 sm:p-6">
          <SignInForm />
        </div>
      </section>
    </main>
  );
}
