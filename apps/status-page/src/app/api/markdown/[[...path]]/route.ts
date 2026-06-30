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
  parseMarkdownPath,
} from "@/content/markdown";
import { getBaseUrl } from "@/lib/base-url";
import { resolveClientIp } from "@/lib/http/client-ip";
import { resolveMarkdownResponse } from "@/lib/http/markdown-response";
import { type GatePage, resolveGate } from "@/lib/proxy/resolve-gate";
import { getQueryClient, trpc } from "@/lib/trpc/server";

// Match the feed route: getQueryClient/httpBatchLink needs Node, not Edge.
export const runtime = "nodejs";

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
  const {
    status,
    body: finalBody,
    headers,
  } = resolveMarkdownResponse(request, {
    body,
    source,
    whiteLabel,
    accessType,
  });
  return new NextResponse(finalBody, { status, headers });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  try {
    const { path = [] } = await params;
    const parsed = parseMarkdownPath(path);
    if (!parsed) return textResponse("Not Found", 404);
    const { slug, rest } = parsed;

    const target = matchMarkdownRoute(rest);
    if (!target) return textResponse("Not Found", 404);

    const source = request.headers.get("x-md-source");
    const queryClient = getQueryClient();
    const url = new URL(request.url);
    const cookieStore = await cookies();
    const headerStore = await headers();
    const clientIp = resolveClientIp(headerStore);

    // Returns a response when the gate denies, null when it passes.
    async function denyResponse(gatePage: GatePage) {
      const gate = await resolveGate({
        page: gatePage,
        queryClient,
        url,
        cookieStore,
        clientIp,
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
          generateOverview(page, uptime, baseUrl, showUptime),
          source,
          page.whiteLabel,
          page.accessType,
        );
      }
      // Detail pages: the detail queries don't carry access fields, so gate via
      // getGate — a narrow access-only query — before fetching the (heavier)
      // detail payload.
      case "monitor":
      case "report":
      case "maintenance": {
        const light = await queryClient.fetchQuery(
          trpc.statusPage.getGate.queryOptions({ slug }),
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
