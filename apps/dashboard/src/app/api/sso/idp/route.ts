import { db } from "@openstatus/db";
import {
  getWorkspaceByWorkosOrganization,
  isWorkOSConfigured,
  resolveWorkOS,
} from "@openstatus/services/sso";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { signIn } from "@/lib/auth";
import { SSO_ORG_COOKIE } from "@/lib/sso-cookie";

function denied(req: NextRequest) {
  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("error", "AccessDenied");
  return NextResponse.redirect(url);
}

/**
 * Registered as the *default* redirect URI in WorkOS, which is only used for
 * IdP-initiated logins — SP-initiated flows send their own `redirect_uri` and
 * go straight to the Auth.js callback.
 *
 * IdP-initiated logins cannot traverse the Auth.js callback: it requires a PKCE
 * cookie that only exists when the flow started here. WorkOS's guidance is to
 * disable IdP-initiated SSO and restart as SP-initiated, which is what this
 * route does.
 */
export async function GET(req: NextRequest) {
  if (!isWorkOSConfigured()) return denied(req);

  const error = req.nextUrl.searchParams.get("error");
  const connectionId = req.nextUrl.searchParams.get("connection_id");
  if (error !== "idp_initiated_sso_disabled" || !connectionId) {
    return denied(req);
  }

  const connection = await resolveWorkOS(undefined)
    .sso.getConnection(connectionId)
    .catch(() => null);

  const organizationId = connection?.organizationId;
  if (!organizationId) return denied(req);

  const workspace = await getWorkspaceByWorkosOrganization(
    db,
    organizationId,
  ).catch(() => null);
  if (!workspace?.ssoEnabled) return denied(req);

  const cookieStore = await cookies();
  cookieStore.set(SSO_ORG_COOKIE, organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 10,
    path: "/",
  });

  await signIn(
    "workos",
    { redirectTo: "/overview" },
    { organization: organizationId },
  );

  return denied(req);
}
