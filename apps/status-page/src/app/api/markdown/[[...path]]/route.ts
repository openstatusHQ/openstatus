import type { Page } from "@openstatus/db/src/schema";
import { cookies, headers } from "next/headers";
import { type NextRequest, NextResponse } from "next/server";

import {
  generateEventsList,
  generateMaintenance,
  generateMonitor,
  generateMonitorsList,
  generateOverview,
  generateReport,
  matchMarkdownRoute,
  withPoweredBy,
} from "@/content/markdown";
import { auth } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { computeETag, isNotModified } from "@/lib/http/etag";
import { createProtectedCookieKey } from "@/lib/protected";
import { evaluateMarkdownGate } from "@/lib/proxy/evaluate-markdown-gate";
import { markdownCacheControl } from "@/lib/proxy/markdown-cache-control";
import { getQueryClient, trpc } from "@/lib/trpc/server";

// Match the feed route: getQueryClient/httpBatchLink needs Node, not Edge.
export const runtime = "nodejs";

const MARKDOWN = "text/markdown; charset=utf-8";
const PLAIN = "text/plain; charset=utf-8";

function textResponse(body: string, status: number) {
  return new NextResponse(body, {
    status,
    headers: { "Content-Type": PLAIN, "Cache-Control": "no-store" },
  });
}

function markdownResponse(
  request: NextRequest,
  body: string,
  source: string | null,
  whiteLabel: boolean,
  accessType: string | null | undefined,
) {
  const finalBody = withPoweredBy(body, whiteLabel);
  const etag = computeETag(finalBody);
  const cacheControl = markdownCacheControl(source, accessType);
  if (isNotModified(request, etag)) {
    return new NextResponse(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": cacheControl,
        "Content-Type": MARKDOWN,
        // Same URL serves HTML or markdown by Accept — shared caches must split.
        Vary: "Accept",
      },
    });
  }
  return new NextResponse(finalBody, {
    status: 200,
    headers: {
      "Content-Type": MARKDOWN,
      "Cache-Control": cacheControl,
      ETag: etag,
      Vary: "Accept",
    },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  try {
    const { path = [] } = await params;
    // _locale is ignored — markdown content is locale-agnostic.
    const [slug, _locale, ...rest] = path;
    if (!slug) return textResponse("Not Found", 404);

    const target = matchMarkdownRoute(rest);
    if (!target) return textResponse("Not Found", 404);

    const source = request.headers.get("x-md-source");
    const queryClient = getQueryClient();
    const url = new URL(request.url);
    // `Accept: text/markdown` negotiation (not a `.md` link a human clicked) is
    // almost always a programmatic agent; `?view=summary` is the explicit opt-in.
    const agent =
      source === "header" || url.searchParams.get("view") === "summary";
    const cookieStore = await cookies();
    const headerStore = await headers();
    const xff = headerStore.get("x-forwarded-for");
    const clientIp = xff?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip");

    // Shared gate over whichever page payload carries the access fields. `auth()`
    // runs only for email-domain pages. Returns null when the gate passed.
    async function denyResponse(gatePage: {
      accessType: Page["accessType"];
      authEmailDomains: string[] | null;
      allowedIpRanges: string[] | null;
      slug: string;
    }) {
      const session =
        gatePage.accessType === "email-domain" ? await auth() : null;
      const passwordAuthorized =
        gatePage.accessType === "password"
          ? await queryClient.fetchQuery(
              trpc.statusPage.isPasswordAuthorized.queryOptions({
                slug: gatePage.slug,
                queryPassword: url.searchParams.get("pw"),
                cookiePassword: cookieStore.get(
                  createProtectedCookieKey(gatePage.slug),
                )?.value,
              }),
            )
          : false;
      const gate = evaluateMarkdownGate({
        accessType: gatePage.accessType,
        passwordAuthorized,
        authEmail: session?.user?.email,
        authEmailDomains: gatePage.authEmailDomains,
        clientIp,
        allowedIpRanges: gatePage.allowedIpRanges,
      });
      return gate.ok ? null : textResponse(gate.body, gate.status);
    }

    switch (target.kind) {
      // List pages render from `get`, which also carries the access fields — so
      // we gate off the same payload instead of a second full-graph getLight.
      case "overview":
      case "monitors":
      case "events": {
        const page = await queryClient.fetchQuery(
          trpc.statusPage.get.queryOptions({ slug }),
        );
        if (!page) return textResponse("Not Found", 404);
        const denied = await denyResponse(page);
        if (denied) return denied;

        const baseUrl = getBaseUrl({
          slug: page.slug,
          customDomain: page.customDomain,
        });

        if (target.kind === "monitors") {
          return markdownResponse(
            request,
            generateMonitorsList(page, baseUrl),
            source,
            page.whiteLabel,
            page.accessType,
          );
        }
        if (target.kind === "events") {
          return markdownResponse(
            request,
            generateEventsList(page, baseUrl),
            source,
            page.whiteLabel,
            page.accessType,
          );
        }
        // Mirror what the live page renders: bar/card type and the uptime
        // toggle come from the page configuration, not hardcoded defaults.
        const cardType = page.configuration?.value ?? "requests";
        const barType = page.configuration?.type ?? "absolute";
        const showUptime = page.configuration?.uptime ?? true;
        // Per-day uptime series (Tinybird) — only after the gate passes.
        const uptime =
          (await queryClient.fetchQuery(
            trpc.statusPage.getUptime.queryOptions({
              slug,
              pageComponentIds: page.pageComponents.map((c) => c.id.toString()),
              cardType,
              barType,
            }),
          )) ?? [];
        return markdownResponse(
          request,
          generateOverview(page, uptime, baseUrl, showUptime, agent),
          source,
          page.whiteLabel,
          page.accessType,
        );
      }
      // Detail pages: the detail queries don't carry access fields, so gate via
      // getLight before fetching the (heavier) detail payload.
      case "monitor":
      case "report":
      case "maintenance": {
        const light = await queryClient.fetchQuery(
          trpc.statusPage.getLight.queryOptions({ slug }),
        );
        if (!light) return textResponse("Not Found", 404);
        const denied = await denyResponse(light);
        if (denied) return denied;

        const baseUrl = getBaseUrl({
          slug: light.slug,
          customDomain: light.customDomain,
        });

        if (target.kind === "monitor") {
          const monitor = await queryClient.fetchQuery(
            trpc.statusPage.getMonitor.queryOptions({ slug, id: target.id }),
          );
          if (!monitor) return textResponse("Not Found", 404);
          return markdownResponse(
            request,
            generateMonitor(monitor, baseUrl, {
              homepageUrl: light.homepageUrl,
              contactUrl: light.contactUrl,
            }),
            source,
            light.whiteLabel,
            light.accessType,
          );
        }
        if (target.kind === "report") {
          const report = await queryClient.fetchQuery(
            trpc.statusPage.getReport.queryOptions({ slug, id: target.id }),
          );
          if (!report) return textResponse("Not Found", 404);
          return markdownResponse(
            request,
            generateReport(report, baseUrl, {
              homepageUrl: light.homepageUrl,
              contactUrl: light.contactUrl,
            }),
            source,
            light.whiteLabel,
            light.accessType,
          );
        }
        const maintenance = await queryClient.fetchQuery(
          trpc.statusPage.getMaintenance.queryOptions({ slug, id: target.id }),
        );
        if (!maintenance) return textResponse("Not Found", 404);
        return markdownResponse(
          request,
          generateMaintenance(maintenance, baseUrl, {
            homepageUrl: light.homepageUrl,
            contactUrl: light.contactUrl,
          }),
          source,
          light.whiteLabel,
          light.accessType,
        );
      }
    }
  } catch (error) {
    console.error("Error serving status-page markdown:", error);
    return textResponse("Internal Server Error", 500);
  }
}
