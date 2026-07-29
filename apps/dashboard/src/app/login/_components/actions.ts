"use server";

import { getWorkspaceByVerifiedSsoDomain } from "@openstatus/services/sso";
import { cookies, headers } from "next/headers";

import { signIn } from "@/lib/auth";
import { ssoLookupRateLimit } from "@/lib/rate-limit/sso-lookup";
import { SSO_ORG_COOKIE } from "@/lib/sso-cookie";

export async function signInWithResendAction(formData: FormData) {
  try {
    await signIn("resend", formData);
  } catch (e) {
    console.error(e);
  }
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
  const redirectToRaw = String(formData.get("redirectTo") ?? "");
  const redirectTo =
    redirectToRaw.startsWith("/") && !redirectToRaw.startsWith("//")
      ? redirectToRaw
      : "/overview";

  if (!email.includes("@")) return { error: GENERIC_ERROR };

  const headerList = await headers();
  const ip =
    headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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
