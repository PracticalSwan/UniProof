import type { Metadata } from "next";

import { AuthCompletionRedirect } from "@/components/auth/auth-completion-redirect";

export const metadata: Metadata = {
  title: "Completing sign-in",
  robots: { index: false, follow: false },
};

export default function AuthCompletePage() {
  return <AuthCompletionRedirect />;
}
