import { cookies } from "next/headers";
import { d } from "@vercel/blob/dist/put-fca5396f";
import { OAuth2RequestError } from "arctic";
import { generateId } from "lucia";

import { and, db, eq } from "@openstatus/db";
import { oauthAccount, user } from "@openstatus/db/src/schema";

import { github, lucia } from "@/lib/auth";

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = cookies().get("github_oauth_state")?.value ?? null;
  if (!code || !state || !storedState || state !== storedState) {
    return new Response(null, {
      status: 400,
    });
  }

  try {
    const tokens = await github.validateAuthorizationCode(code);
    const remoteUser = await fetch("https://api.github.com/user", {
      headers: {
        Authorization: `Bearer ${tokens.accessToken}`,
      },
    });
    const googleUser: GoogleUser = await remoteUser.json();

    const existingUser = await db
      .select()
      .from(oauthAccount)
      .where(
        and(
          eq(oauthAccount.providerId, "google"),
          eq(oauthAccount.providerUserId, googleUser.id),
        ),
      )
      .get();
    if (existingUser) {
      const session = await lucia.createSession(existingUser.userId, {});
      const sessionCookie = lucia.createSessionCookie(session.id);
      cookies().set(
        sessionCookie.name,
        sessionCookie.value,
        sessionCookie.attributes,
      );
      return new Response(null, {
        status: 302,
        headers: {
          Location: "/",
        },
      });
    }

    const userId = generateId(15);
    await db
      .insert(user)
      .values({
        id: userId,
        firstName: googleUser.firstName,
        lastName: googleUser.lastName,
        email: googleUser.email,
        photoUrl: googleUser.profileUrl,
        // Still needed  but going to be removed soon
        tenantId: userId,
      })
      .execute();

    await db
      .insert(oauthAccount)
      .values({
        providerId: "google",
        providerUserId: googleUser.id,
        userId,
      })
      .execute();
    const session = await lucia.createSession(userId, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );
    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
      },
    });
  } catch (e) {
    if (
      e instanceof OAuth2RequestError &&
      e.message === "bad_verification_code"
    ) {
      // invalid code
      return new Response(null, {
        status: 400,
      });
    }
    return new Response(null, {
      status: 500,
    });
  }
}

// FIXME: use zod
interface GoogleUser {
  id: string;
  firstName: string;
  lastName: string;
  profileUrl: string;
  email: string;
}
