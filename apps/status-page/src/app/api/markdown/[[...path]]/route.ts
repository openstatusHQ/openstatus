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
} from "@/content/markdown";
import { auth } from "@/lib/auth";
import { getBaseUrl } from "@/lib/base-url";
import { createProtectedCookieKey } from "@/lib/protected";
import { evaluateMarkdownGate } from "@/lib/proxy/evaluate-markdown-gate";
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

function markdownResponse(body: string, source: string | null) {
  const cacheControl =
    source === "suffix"
      ? "public, max-age=60, s-maxage=60, stale-while-revalidate=300"
      : "private, no-store";
  return new NextResponse(body, {
    status: 200,
    headers: { "Content-Type": MARKDOWN, "Cache-Control": cacheControl },
  });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path?: string[] }> },
) {
  try {
    const { path = [] } = await params;
    const [slug, _locale, ...rest] = path;
    if (!slug) return textResponse("Not Found", 404);

    const target = matchMarkdownRoute(rest);
    if (!target) return textResponse("Not Found", 404);

    const source = request.headers.get("x-md-source");
    const queryClient = getQueryClient();

    // Gate before any heavy/Tinybird fetch — getLight carries the access fields
    // and runs no Tinybird queries.
    const light = await queryClient.fetchQuery(
      trpc.statusPage.getLight.queryOptions({ slug }),
    );
    if (!light) return textResponse("Not Found", 404);

    const url = new URL(request.url);
    const cookieStore = await cookies();
    const headerStore = await headers();
    const session = light.accessType === "email-domain" ? await auth() : null;
    const xff = headerStore.get("x-forwarded-for");
    const clientIp = xff?.split(",")[0]?.trim() ?? headerStore.get("x-real-ip");

    const gate = evaluateMarkdownGate({
      accessType: light.accessType,
      password: light.password ?? null,
      queryPassword: url.searchParams.get("pw"),
      cookiePassword: cookieStore.get(createProtectedCookieKey(light.slug))
        ?.value,
      authEmail: session?.user?.email,
      authEmailDomains: light.authEmailDomains,
      clientIp,
      allowedIpRanges: light.allowedIpRanges,
    });

    if (!gate.ok) return textResponse(gate.body, gate.status);

    const baseUrl = getBaseUrl({
      slug: light.slug,
      customDomain: light.customDomain,
    });

    switch (target.kind) {
      case "overview":
      case "monitors":
      case "events": {
        const page = await queryClient.fetchQuery(
          trpc.statusPage.get.queryOptions({ slug }),
        );
        if (!page) return textResponse("Not Found", 404);
        const md =
          target.kind === "overview"
            ? generateOverview(page, baseUrl)
            : target.kind === "monitors"
              ? generateMonitorsList(page, baseUrl)
              : generateEventsList(page, baseUrl);
        return markdownResponse(md, source);
      }
      case "monitor": {
        const monitor = await queryClient.fetchQuery(
          trpc.statusPage.getMonitor.queryOptions({ slug, id: target.id }),
        );
        if (!monitor) return textResponse("Not Found", 404);
        return markdownResponse(generateMonitor(monitor, baseUrl), source);
      }
      case "report": {
        const report = await queryClient.fetchQuery(
          trpc.statusPage.getReport.queryOptions({ slug, id: target.id }),
        );
        if (!report) return textResponse("Not Found", 404);
        return markdownResponse(generateReport(report, baseUrl), source);
      }
      case "maintenance": {
        const maintenance = await queryClient.fetchQuery(
          trpc.statusPage.getMaintenance.queryOptions({ slug, id: target.id }),
        );
        if (!maintenance) return textResponse("Not Found", 404);
        return markdownResponse(
          generateMaintenance(maintenance, baseUrl),
          source,
        );
      }
    }
  } catch (error) {
    console.error("Error serving status-page markdown:", error);
    return textResponse("Internal Server Error", 500);
  }
}
