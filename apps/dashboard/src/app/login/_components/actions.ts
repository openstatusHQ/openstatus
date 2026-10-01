"use server";

import { resolveClientIp } from "@openstatus/services/page-access";
import { getWorkspaceByVerifiedSsoDomain } from "@openstatus/services/sso";
import { AuthError } from "next-auth";
import { cookies, headers } from "next/headers";

import { signIn } from "@/lib/auth";
import { ssoLookupRateLimit } from "@/lib/rate-limit/sso-lookup";
import { SSO_ORG_COOKIE } from "@/lib/sso-cookie";

// Same-origin paths only; the Auth.js `redirect` callback is the second line
// of defense, not the first.
function sanitizeRedirectTo(raw: FormDataEntryValue | null) {
  const value = String(raw ?? "");
  return value.startsWith("/") && !value.startsWith("//") ? value : undefined;
}

export type MagicLinkFormState = { sent?: boolean; error?: string };

// One message for every refusal (bad address, disposable domain, throttled,
// send failure): the form must not tell a caller which addresses exist or
// what we filter. The screening itself runs in the Resend provider.
const MAGIC_LINK_ERROR =
  "We couldn't send a sign-in link to that address. Try GitHub or Google.";

export async function signInWithMagicLink(
  _prevState: MagicLinkFormState,
  formData: FormData,
): Promise<MagicLinkFormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) return { error: MAGIC_LINK_ERROR };

  // next-auth lifts `redirectTo` into the magic link's `callbackUrl` itself.
  // In a server action Auth.js rethrows `AuthError`s; anything else comes back
  // as the `?error=` URL it would have redirected to.
  try {
    const url = await signIn("resend", {
      email,
      redirectTo: sanitizeRedirectTo(formData.get("redirectTo")),
      redirect: false,
    });
    if (typeof url === "string" && new URL(url).searchParams.has("error")) {
      return { error: MAGIC_LINK_ERROR };
    }
  } catch (e) {
    if (!(e instanceof AuthError)) throw e;
    console.error("magic link sign-in failed", e);
    return { error: MAGIC_LINK_ERROR };
  }

  return { sent: true };
}

export type SsoFormState = { error?: string };

// Deliberately identical for "no such domain", "SSO disabled" and "rate
// limited": a specific message would tell an unauthenticated caller which
// companies use openstatus and which of them have SSO.
const GENERIC_ERROR =
  "We couldn't start SSO for that email. Try GitHub or Google.";

export async function startSsoSignIn(
  _prevState: SsoFormState,
  formData: FormData,
): Promise<SsoFormState> {
  const email = String(formData.get("email") ?? "");
  const redirectTo =
    sanitizeRedirectTo(formData.get("redirectTo")) ?? "/overview";

  if (!email.includes("@")) return { error: GENERIC_ERROR };

  const ip = resolveClientIp(await headers()) ?? "unknown";
  if (!(await ssoLookupRateLimit(ip))) return { error: GENERIC_ERROR };

  const workspace = await getWorkspaceByVerifiedSsoDomain(email);
  if (!workspace?.workosOrganizationId) return { error: GENERIC_ERROR };

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
    { redirectTo },
    { organization: workspace.workosOrganizationId },
  );

  return {};
}
