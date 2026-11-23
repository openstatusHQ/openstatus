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
  page: Pick<Page, "accessType" | "password">;
  host: string;
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
  if (!queryPassword && !cookiePassword) return untouched;

  const attempt: Attempt = {
    scope: "login",
    slug: args.host,
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
