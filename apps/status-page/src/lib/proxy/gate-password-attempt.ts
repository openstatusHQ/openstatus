import type { Page } from "@openstatus/db/src/schema";
import { isPasswordAuthorized } from "@openstatus/services/page-access";

type Attempt = { scope: "login"; slug: string; ip: string | null };

export type PasswordAttemptLimiter = {
  reserve(
    attempt: Attempt,
  ): Promise<{ locked: boolean; release(): Promise<void> }>;
};

/**
 * Rate-limits the passwords a request presents to the proxy (`?pw=` or the
 * page cookie), sharing the login form's budget so a locked visitor lands on
 * /login and sees why. While locked, presented passwords are ignored; a wrong
 * cookie is cleared so a real visitor's stale cookie costs one failure.
 */
export async function gatePasswordAttempt(args: {
  page: Pick<Page, "accessType" | "password" | "slug">;
  clientIp: string | null;
  queryPassword: string | null;
  cookiePassword: string | undefined;
  limiter: PasswordAttemptLimiter;
}): Promise<{
  queryPassword: string | null;
  cookiePassword: string | undefined;
  clearCookie: boolean;
}> {
  const { page, queryPassword, cookiePassword, limiter } = args;
  const untouched = { queryPassword, cookiePassword, clearCookie: false };
  if (page.accessType !== "password") return untouched;
  // "" can never authorize (an empty stored password is rejected), so it is
  // not a guess.
  if (!queryPassword && !cookiePassword) return untouched;

  const attempt: Attempt = {
    scope: "login",
    // The login form posts the slug, also on a custom domain: share its bucket.
    slug: page.slug,
    ip: args.clientIp,
  };
  const slot = await limiter.reserve(attempt);
  if (slot.locked) {
    return {
      queryPassword: null,
      cookiePassword: undefined,
      clearCookie: false,
    };
  }

  const authorized = isPasswordAuthorized({
    stored: page.password,
    queryPassword,
    cookiePassword,
  });
  if (authorized) {
    await slot.release();
    return untouched;
  }
  return { queryPassword, cookiePassword, clearCookie: !!cookiePassword };
}
