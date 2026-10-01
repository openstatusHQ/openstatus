"use server";

import { resolveClientIp } from "@openstatus/services/page-access";
import { getWorkspaceByVerifiedSsoDomain } from "@openstatus/services/sso";
import { AuthError } from "next-auth";
import { cookies, headers } from "next/headers";

import { signIn } from "@/lib/auth";
import { ssoLookupRateLimit } from "@/lib/rate-limit/sso-lookup";
import { SSO_ORG_COOKIE } from "@/lib/sso-cookie";

const hasWorkOS = Boolean(
  process.env.AUTH_WORKOS_ID && process.env.AUTH_WORKOS_SECRET,
);

// Same-origin paths only; the Auth.js `redirect` callback is the second line
// of defense, not the first.
function sanitizeRedirectTo(raw: FormDataEntryValue | null) {
  const value = String(raw ?? "");
  return value.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

export type EmailFormState = { sent?: boolean; error?: string };

// One message for every refusal (bad address, disposable domain, throttled,
// send failure): the form must not tell a caller which addresses exist or
// what we filter. The screening itself runs in the Resend provider.
const EMAIL_ERROR =
  "We couldn't send a sign-in link to that address. Try GitHub or Google.";

/**
 * Routes by domain: a verified SSO domain goes to the identity provider,
 * everything else gets a magic link. SSO is an additional way in, not a
 * replacement (GitHub and Google stay available), so an SSO-domain address
 * that reaches the Resend provider directly is still allowed.
 */
export async function continueWithEmail(
  _prevState: EmailFormState,
  formData: FormData,
): Promise<EmailFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: EMAIL_ERROR };

  const redirectTo = sanitizeRedirectTo(formData.get("redirectTo"));

  if (hasWorkOS) {
    const ip = resolveClientIp(await headers()) ?? "unknown";
    // The lookup limiter guards the SSO-domain oracle, not the login: once it
    // trips (shared office IP), the address takes the magic-link path instead.
    const workspace = (await ssoLookupRateLimit(ip))
      ? await getWorkspaceByVerifiedSsoDomain(email)
      : null;
    if (workspace?.workosOrganizationId) {
      const cookieStore = await cookies();
      cookieStore.set(SSO_ORG_COOKIE, workspace.workosOrganizationId, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 10,
        path: "/",
      });
      await signIn(
        "workos",
        { redirectTo: redirectTo ?? "/overview" },
        { organization: workspace.workosOrganizationId },
      );
      return {};
    }
  }

  // next-auth lifts `redirectTo` into the magic link's `callbackUrl` itself.
  // In a server action Auth.js rethrows `AuthError`s; anything else comes back
  // as the `?error=` URL it would have redirected to.
  try {
    const url = await signIn("resend", { email, redirectTo, redirect: false });
    if (typeof url === "string" && new URL(url).searchParams.has("error")) {
      return { error: EMAIL_ERROR };
    }
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    console.error("magic link sign-in failed", e);
    return { error: EMAIL_ERROR };
  }

  return { sent: true };
}
