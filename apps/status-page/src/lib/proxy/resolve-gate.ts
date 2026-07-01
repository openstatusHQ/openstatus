import type { Page } from "@openstatus/db/src/schema";

import { auth } from "../auth";
import { createProtectedCookieKey } from "../protected";
import type { getQueryClient } from "../trpc/server";
import { trpc } from "../trpc/server";
import {
  evaluateMarkdownGate,
  type MarkdownGateResult,
} from "./evaluate-markdown-gate";

export type GatePage = {
  accessType: Page["accessType"];
  authEmailDomains: string[] | null;
  allowedIpRanges: string[] | null;
  slug: string;
};

/**
 * Server-side orchestration around `evaluateMarkdownGate`: resolves the session
 * (email-domain pages) and password authorization (password pages) before
 * delegating to the pure decision. Shared by the markdown and status JSON API
 * routes, both reachable directly via `/api` — bypassing the proxy gate.
 */
export async function resolveGate(args: {
  page: GatePage;
  queryClient: ReturnType<typeof getQueryClient>;
  url: URL;
  cookieStore: { get(name: string): { value: string } | undefined };
  clientIp: string | null | undefined;
}): Promise<MarkdownGateResult> {
  const { page, queryClient, url, cookieStore, clientIp } = args;
  const session = page.accessType === "email-domain" ? await auth() : null;
  const passwordAuthorized =
    page.accessType === "password"
      ? await queryClient.fetchQuery(
          trpc.statusPage.isPasswordAuthorized.queryOptions({
            slug: page.slug,
            queryPassword: url.searchParams.get("pw"),
            cookiePassword: cookieStore.get(createProtectedCookieKey(page.slug))
              ?.value,
          }),
        )
      : false;
  return evaluateMarkdownGate({
    accessType: page.accessType,
    passwordAuthorized,
    authEmail: session?.user?.email,
    authEmailDomains: page.authEmailDomains,
    clientIp,
    allowedIpRanges: page.allowedIpRanges,
  });
}
