import { db, sql } from "@openstatus/db";
import { page } from "@openstatus/db/src/schema";
import { cookies, headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  matchEndpoint,
  toStatus,
  toSummary,
  toUnresolvedIncidents,
} from "@/content/status-json";
import { getBaseUrl } from "@/lib/base-url";
import { stripHostPort } from "@/lib/domain";
import { resolveClientIp } from "@/lib/http/client-ip";
import { computeETag, isNotModified } from "@/lib/http/etag";
import { resolveGate } from "@/lib/proxy/resolve-gate";
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

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  try {
    const { path = [] } = await params;
    const matched = matchEndpoint(path);
    if (!matched) return json({ error: "Not Found" }, 404);
    const { endpoint, slug: pathSlug } = matched;

    const url = new URL(request.url);
    // Strip the port: custom-domain lookups exact-match the port-less
    // page.customDomain (parity with sitemap.ts / robots.ts).
    const host = stripHostPort(request.headers.get("x-forwarded-host"));
    // Host-keyed deploys (subdomain/custom domain) resolve from the host; a
    // path-based deploy carries the slug in the URL (`{slug}/summary.json`),
    // so feed it through resolveRoute as the pathname prefix.
    const route = resolveRoute({
      host,
      urlHost: host ?? url.host,
      pathname: pathSlug ? `/${pathSlug}` : "/",
    });
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
    const gate = await resolveGate({
      page: data,
      queryClient,
      url,
      cookieStore,
      clientIp,
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
