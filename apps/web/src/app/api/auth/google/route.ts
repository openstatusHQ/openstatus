import { cookies } from "next/headers";
import { generateCodeVerifier, generateState } from "arctic";

import { google } from "@/lib/auth";

export async function GET(): Promise<Response> {
  const state = generateState();

  const codeVerifier = await generateCodeVerifier();
  const url = await google.createAuthorizationURL(state, codeVerifier, {
    scopes: ["profile", "email"],
  });

  cookies().set("google_oauth_state", state, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
    maxAge: 60 * 10,
    sameSite: "lax",
  });

  return Response.redirect(url);
}
