import { cookies } from "next/headers";

import {
  AUTH_REDIRECT_COOKIE,
  AUTH_REDIRECT_COOKIE_OPTIONS,
} from "@/lib/auth-redirect-cookie";

// Same-origin paths only; the Auth.js `redirect` callback is the second line
// of defense, not the first.
export function sanitizeRedirectTo(raw: FormDataEntryValue | null) {
  const value = String(raw ?? "");
  return value.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

/**
 * Reads the form's `redirectTo` (with the client-added `#section`) and
 * refreshes the onboarding fallback cookie with it: the proxy wrote that
 * cookie before the browser could tell it the hash.
 */
export async function takeRedirectTo(formData: FormData) {
  const redirectTo = sanitizeRedirectTo(formData.get("redirectTo"));
  if (redirectTo) {
    const cookieStore = await cookies();
    cookieStore.set(
      AUTH_REDIRECT_COOKIE,
      redirectTo,
      AUTH_REDIRECT_COOKIE_OPTIONS,
    );
  }
  return redirectTo;
}
