import { db, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { cookies, headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  toStatus,
  toSummary,
  toUnresolvedIncidents,
} from "@/content/status-json";
import { auth } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { resolveClientIp } from "@/lib/http/client-ip";
import { computeETag, isNotModified } from "@/lib/http/etag";
import { createProtectedCookieKey } from "@/lib/protected";
import { evaluateMarkdownGate } from "@/lib/proxy/evaluate-markdown-gate";
import { resolveRoute } from "@/lib/resolve-route";
import { getQueryClient, trpc } from "@/lib/trpc/server";

// trpc httpBatchLink needs Node, matching the markdown route.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: unknown, status: number, extraHeaders?: HeadersInit) {
  return new NextResponse(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...extraHeaders,
    },
  });
}

type Endpoint = "summary" | "status" | "incidents";

function matchEndpoint(path: string[]): Endpoint | null {
  if (path.length === 1 && path[0] === "summary.json") return "summary";
  if (path.length === 1 && path[0] === "current.json") return "status";
  if (path.length === 1 && path[0] === "incidents.json") return "incidents";
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  try {
    const { path = [] } = await params;
    const endpoint = matchEndpoint(path);
    if (!endpoint) return json({ error: "Not Found" }, 404);

    const url = new URL(request.url);
    const host = request.headers.get("x-forwarded-host");
    const route = resolveRoute({ host, urlHost: url.host, pathname: "/" });
    if (!route) return json({ error: "Not Found" }, 404);

    const row = await db
      .select({ slug: page.slug })
      .from(page)
      .where(
        sql`lower(${page.slug}) = ${route.prefix} OR lower(${page.customDomain}) = ${route.prefix}`,
      )
      .get();
    if (!row) return json({ error: "Not Found" }, 404);

    const queryClient = getQueryClient();
    const data = await queryClient.fetchQuery(
      trpc.statusPage.get.queryOptions({ slug: row.slug }),
    );
    if (!data) return json({ error: "Not Found" }, 404);

    const headerStore = await headers();
    const cookieStore = await cookies();
    const clientIp = resolveClientIp(headerStore);
    const session = data.accessType === "email-domain" ? await auth() : null;
    const passwordAuthorized =
      data.accessType === "password"
        ? await queryClient.fetchQuery(
            trpc.statusPage.isPasswordAuthorized.queryOptions({
              slug: data.slug,
              queryPassword: url.searchParams.get("pw"),
              cookiePassword: cookieStore.get(
                createProtectedCookieKey(data.slug),
              )?.value,
            }),
          )
        : false;
    const gate = evaluateMarkdownGate({
      accessType: data.accessType,
      passwordAuthorized,
      authEmail: session?.user?.email,
      authEmailDomains: data.authEmailDomains,
      clientIp,
      allowedIpRanges: data.allowedIpRanges,
    });
    if (!gate.ok) return json({ error: gate.body }, gate.status);

    const baseUrl = getBaseUrl({
      slug: data.slug,
      customDomain: data.customDomain ?? undefined,
    });

    const payload =
      endpoint === "status"
        ? toStatus(data, baseUrl)
        : endpoint === "incidents"
          ? toUnresolvedIncidents(data, baseUrl)
          : toSummary(data, baseUrl);

    const body = JSON.stringify(payload);
    const etag = computeETag(body);
    const cacheControl =
      data.accessType === "public"
        ? "public, max-age=30, stale-while-revalidate=60"
        : "private, no-store";

    if (isNotModified(request, etag)) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": cacheControl,
          "Content-Type": "application/json; charset=utf-8",
        },
      });
    }

    return new NextResponse(body, {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": cacheControl,
        ETag: etag,
      },
    });
  } catch (error) {
    console.error("Error serving status-page status JSON:", error);
    return json({ error: "Internal Server Error" }, 500);
  }
}
