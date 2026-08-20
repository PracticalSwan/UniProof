import { z } from "zod";

const AUTH_EMAIL_MAX_LENGTH = 254;
const AUTH_INTERNAL_DESTINATIONS = ["/saved", "/research", "/compare", "/guide"] as const;

export const authEmailSchema = z.string()
  .trim()
  .min(3)
  .max(AUTH_EMAIL_MAX_LENGTH)
  .email()
  .refine((value) => /^[\x21-\x7e]+$/u.test(value), "Email must use printable ASCII characters.");

export const authMagicLinkIntentResponseSchema = z.object({
  state: z.string().regex(/^[a-f0-9]{32}$/u),
}).strict();

export type AuthInternalDestination = (typeof AUTH_INTERNAL_DESTINATIONS)[number];

export function safeInternalAuthRedirect(value: unknown): AuthInternalDestination | null {
  if (typeof value !== "string") return null;
  return (AUTH_INTERNAL_DESTINATIONS as readonly string[]).includes(value)
    ? value as AuthInternalDestination
    : null;
}

export const authSessionResponseSchema = z.discriminatedUnion("authenticated", [
  z.object({ authenticated: z.literal(false) }).strict(),
  z.object({ authenticated: z.literal(true), userId: z.uuid() }).strict(),
]);

export type AuthSessionResponse = z.infer<typeof authSessionResponseSchema>;

export type SanitizedAuthRequestError = Readonly<{
  code: "auth-unavailable";
  message: string;
}>;

export function sanitizeAuthRequestError(error: unknown): SanitizedAuthRequestError {
  void error;
  return {
    code: "auth-unavailable",
    message: "The sign-in request could not be completed. Try again shortly.",
  };
}
