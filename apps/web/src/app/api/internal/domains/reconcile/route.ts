import { db } from "@openstatus/db/src/db";
import {
  reconcileProjectDomains,
  vercelConfigFromEnv,
} from "@openstatus/services/page";
import { captureMessage } from "@sentry/nextjs";
import type { NextRequest } from "next/server";

// Report-only unless DOMAIN_RECONCILE_APPLY=1. "missing" is never re-attached:
// re-saving the domain in the dashboard heals that page.
export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const config = vercelConfigFromEnv();
  if (!config) return Response.json({ skipped: true });

  const result = await reconcileProjectDomains({
    db,
    config,
    apply: process.env.DOMAIN_RECONCILE_APPLY === "1",
  });

  const remaining = {
    orphans: result.orphans.filter((d) => !result.detached.includes(d)),
    missing: result.missing,
  };
  if (remaining.orphans.length > 0 || remaining.missing.length > 0) {
    console.warn("Custom domain drift between Vercel and page table:", result);
    captureMessage("Custom domain drift between Vercel and page table", {
      level: "warning",
      extra: { ...result, remaining },
    });
  }

  return Response.json(result);
}
