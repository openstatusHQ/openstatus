import crypto from "crypto";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getToken } from "../libs/client";
import { encrypt } from "../libs/crypto";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next");
  const teamId = searchParams.get("teamId");
  console.log({ code, next, teamId });
  if (!code || !next) {
    throw new Error("Missing `code` or `next` param");
  }

  /** Get access token from Vercel */
  const token = await getToken(code);

  // TODO: automatically install log drains to the allowed projects

  const iv = crypto.randomBytes(16);
  const encryptedToken = encrypt(iv, Buffer.from(token));

  // redirect to vercel's integration page after installation
  const res = NextResponse.redirect(next);

  /** Encrypt access token and add to Cookies */
  res.cookies.set("token", encryptedToken.toString("base64url"), {
    secure: true,
  });
  res.cookies.set("iv", iv.toString("base64url"), { secure: true });

  if (teamId) {
    res.cookies.set("teamId", teamId, { secure: true });
  }

  return res;
}

/**
 * The code below is only needed if we allow the user
 * to send the secret link to a team mate e.g.
 */
function getSecretUrl(iv: Buffer, encryptedToken: Buffer) {
  const baseUrl = new URL(process.env.VRCL_REDIRECT_URI!);
  baseUrl.pathname = "/configure";
  baseUrl.searchParams.set("token", encryptedToken.toString("base64url"));
  baseUrl.searchParams.set("iv", iv.toString("base64url"));
  const secretUrl = baseUrl.toString();
  return secretUrl;
}
