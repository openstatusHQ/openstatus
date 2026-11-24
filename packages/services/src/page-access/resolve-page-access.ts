import { type page, selectPageSchema } from "@openstatus/db/src/schema";

import { ForbiddenError, UnauthorizedError } from "../errors";
import { isPasswordAuthorized } from "./access-predicates";
import { pageAccessCookieKey } from "./cookie-key";
import {
  evaluateMarkdownGate,
  type MarkdownGateResult,
} from "./evaluate-markdown-gate";

const accessFieldsSchema = selectPageSchema.pick({
  slug: true,
  accessType: true,
  password: true,
  authEmailDomains: true,
  allowedIpRanges: true,
});

type AccessRow = Pick<
  typeof page.$inferSelect,
  keyof typeof accessFieldsSchema.shape
>;

/** Counts wrong page passwords; the transport supplies one backed by its store. */
export type PasswordAttemptLimiter = {
  /** Reserve before checking; `release` unless the password was wrong. */
  reserve(attempt: {
    slug: string;
    ip: string | null;
  }): Promise<{ locked: boolean; release(): Promise<void> }>;
};

/** What an anonymous status-page visitor presented, extracted by the transport. */
export type PageVisitor = {
  // A getter: only the gate knows the page slug the cookie is keyed on.
  getCookie?: (name: string) => string | null | undefined;
  queryPassword?: string | null;
  email?: string | null;
  clientIp?: string | null;
  /** Without one, password checks are not rate-limited. */
  passwordAttempts?: PasswordAttemptLimiter;
};

export function resolvePageAccess(
  row: AccessRow,
  visitor: PageVisitor,
): MarkdownGateResult {
  const parsed = accessFieldsSchema.safeParse(row);
  if (!parsed.success) return { ok: false, status: 403, body: "Forbidden" };
  const _page = parsed.data;

  return evaluateMarkdownGate({
    accessType: _page.accessType,
    passwordAuthorized:
      _page.accessType === "password" &&
      isPasswordAuthorized({
        stored: _page.password,
        queryPassword: visitor.queryPassword,
        cookiePassword: visitor.getCookie?.(pageAccessCookieKey(_page.slug)),
      }),
    authEmail: visitor.email,
    authEmailDomains: _page.authEmailDomains,
    clientIp: visitor.clientIp,
    allowedIpRanges: _page.allowedIpRanges,
  });
}

export function assertPageAccess(row: AccessRow, visitor: PageVisitor): void {
  const gate = resolvePageAccess(row, visitor);
  if (gate.ok) return;
  throw gate.status === 401
    ? new UnauthorizedError("Page access denied.")
    : new ForbiddenError("Page access denied.");
}

const deniedPassword: MarkdownGateResult = {
  ok: false,
  status: 401,
  body: "Unauthorized",
};

/**
 * `resolvePageAccess`, counting a presented password against the visitor's
 * limiter. Once locked, every password is refused, the right one included.
 */
export async function checkPageAccess(
  row: AccessRow,
  visitor: PageVisitor,
): Promise<MarkdownGateResult> {
  const limiter = visitor.passwordAttempts;
  if (!limiter || row.accessType !== "password") {
    return resolvePageAccess(row, visitor);
  }
  const submitted =
    visitor.queryPassword ?? visitor.getCookie?.(pageAccessCookieKey(row.slug));
  // Nothing (or "") presented can never authorize, so it is not a guess.
  if (!submitted) return resolvePageAccess(row, visitor);

  const slot = await limiter.reserve({
    slug: row.slug,
    ip: visitor.clientIp ?? null,
  });
  if (slot.locked) return deniedPassword;
  const gate = resolvePageAccess(row, visitor);
  if (gate.ok) await slot.release();
  return gate;
}

/** `assertPageAccess`, counting a presented password against the visitor's limiter. */
export async function requirePageAccess(
  row: AccessRow,
  visitor: PageVisitor,
): Promise<void> {
  const gate = await checkPageAccess(row, visitor);
  if (gate.ok) return;
  throw gate.status === 401
    ? new UnauthorizedError("Page access denied.")
    : new ForbiddenError("Page access denied.");
}
