import type { Page } from "@openstatus/db/src/schema";
import { isPasswordAuthorized } from "@openstatus/services/page-access";

type Attempt = { scope: "login"; slug: string; ip: string | null };

export type PasswordAttemptLimiter = {
  isLocked(attempt: Attempt): Promise<boolean>;
  recordFailure(attempt: Attempt, password: string): Promise<unknown>;
};

/**
 * Rate-limits the passwords a request presents to the proxy (`?pw=` or the
 * page cookie), sharing the login form's budget so a locked visitor lands on
 * /login and sees why. While locked, the right password is ignored too; a wrong
 * cookie is cleared, and repeats of one wrong value count once.
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
  // The query password wins over the cookie, as in isPasswordAuthorized. ""
  // can never authorize (an empty stored password is rejected): not a guess.
  const submitted = queryPassword ?? cookiePassword;
  if (!submitted) return untouched;

  const attempt: Attempt = {
    scope: "login",
    // The login form posts the slug, also on a custom domain: share its bucket.
    slug: page.slug,
    ip: args.clientIp,
  };
  const authorized = isPasswordAuthorized({
    stored: page.password,
    queryPassword,
    cookiePassword,
  });
  if (!authorized) {
    await limiter.recordFailure(attempt, submitted);
    return { queryPassword, cookiePassword, clearCookie: !!cookiePassword };
  }
  if (await limiter.isLocked(attempt)) {
    return {
      queryPassword: null,
      cookiePassword: undefined,
      clearCookie: false,
    };
  }
  return untouched;
}
