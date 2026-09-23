import {
  assertPageAccess as assertAccess,
  type PageVisitor,
  resolveClientIp,
  resolvePageAccess as resolveAccess,
} from "@openstatus/services/page-access";

import { toTRPCError } from "../service-adapter";
import type { Context } from "../trpc";

type Ctx = Pick<Context, "req" | "session">;
type AccessRow = Parameters<typeof resolveAccess>[0];

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

export function resolvePageAccess(
  ctx: Ctx,
  row: AccessRow,
  queryPassword?: string | null,
) {
  return resolveAccess(row, visitorFromCtx(ctx, queryPassword));
}

export function assertPageAccess(
  ctx: Ctx,
  row: AccessRow,
  queryPassword?: string | null,
) {
  try {
    assertAccess(row, visitorFromCtx(ctx, queryPassword));
  } catch (err) {
    toTRPCError(err);
  }
}
