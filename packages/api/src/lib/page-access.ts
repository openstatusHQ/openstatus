import {
  type PageVisitor,
  resolveClientIp,
} from "@openstatus/services/page-access";

import type { Context } from "../trpc";
import { pagePasswordRateLimit } from "./page-password-rate-limit";

type Ctx = Pick<Context, "req" | "viewer">;

/** `queryPassword` is for cookie-less server callers (feeds, `?pw=` links). */
export function visitorFromCtx(
  ctx: Ctx,
  queryPassword?: string | null,
): PageVisitor {
  return {
    getCookie: (name) => ctx.req?.cookies.get(name)?.value,
    queryPassword,
    email: ctx.viewer?.email,
    clientIp: ctx.req ? resolveClientIp(ctx.req.headers) : null,
    // One budget per page and IP across every entry point.
    passwordAttempts: pagePasswordRateLimit(),
  };
}
