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

/** What an anonymous status-page visitor presented, extracted by the transport. */
export type PageVisitor = {
  // A getter: only the gate knows the page slug the cookie is keyed on.
  getCookie?: (name: string) => string | null | undefined;
  queryPassword?: string | null;
  email?: string | null;
  clientIp?: string | null;
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
