import { db } from "@openstatus/db/src/db";
import {
  reconcileProjectDomains,
  vercelConfigFromEnv,
} from "@openstatus/services/page";
import { captureMessage } from "@sentry/nextjs";
import type { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const config = vercelConfigFromEnv();
  if (!config) return Response.json({ skipped: true });

  const result = await reconcileProjectDomains({
    db,
    config,
    apply: process.env.DOMAIN_RECONCILE_APPLY === "1",
  });

  if (result.orphans.length > 0 || result.missing.length > 0) {
    console.warn("Custom domain drift between Vercel and page table:", result);
    captureMessage("Custom domain drift between Vercel and page table", {
      level: "warning",
      extra: result,
    });
  }

  return Response.json(result);
}
