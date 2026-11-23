import {
  type PageVisitor,
  resolveClientIp,
} from "@openstatus/services/page-access";

import type { Context } from "../trpc";

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
  };
}
