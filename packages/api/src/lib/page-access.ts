import {
  type PageVisitor,
  type PasswordAttemptLimiter,
  resolveClientIp,
} from "@openstatus/services/page-access";

import type { Context } from "../trpc";
import { pagePasswordRateLimit } from "./page-password-rate-limit";

type Ctx = Pick<Context, "req" | "session">;

/** `queryPassword` is for cookie-less server callers (feeds, `?pw=` links). */
export function visitorFromCtx(
  ctx: Ctx,
  queryPassword?: string | null,
): PageVisitor {
  return {
    getCookie: (name) => ctx.req?.cookies.get(name)?.value,
    queryPassword,
    email: ctx.session?.user?.email,
    clientIp: ctx.req ? resolveClientIp(ctx.req.headers) : null,
    passwordAttempts: loginPasswordAttempts(),
  };
}

// Shares the login form's and the proxy's budget, so guesses spread across
// procedures still hit one cap.
function loginPasswordAttempts(): PasswordAttemptLimiter {
  const limiter = pagePasswordRateLimit();
  return {
    reserve: (attempt) => limiter.reserve({ scope: "login", ...attempt }),
  };
}
