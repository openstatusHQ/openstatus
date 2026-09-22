import { db } from "@openstatus/db";
import type { ServiceContext } from "@openstatus/services";
import { NotFoundError } from "@openstatus/services";
import {
  getWorkspaceByWorkosOrganization,
  isWorkOSConfigured,
  removeSsoDomain,
  syncSsoDomain,
  verifyWorkOSWebhook,
} from "@openstatus/services/sso";
import type { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const secret = process.env.WORKOS_WEBHOOK_SECRET;
  if (!isWorkOSConfigured() || !secret) {
    return new Response("Not found", { status: 404 });
  }

  const sigHeader = req.headers.get("workos-signature");
  if (!sigHeader) return new Response("No signature", { status: 400 });

  const payload = await req.text();

  const event = await verifyWorkOSWebhook({
    payload,
    sigHeader,
    secret,
  }).catch(() => null);

  if (!event) return new Response("Invalid signature", { status: 400 });
  if (event.type === "ignored") return new Response("OK", { status: 200 });

  const { organizationId, domain } = event;

  try {
    const workspace = await getWorkspaceByWorkosOrganization(
      db,
      organizationId,
    );
    const ctx: ServiceContext = {
      workspace,
      actor: { type: "system", job: "workos-webhook" },
    };

    if (event.type === "domain.verified") {
      await syncSsoDomain({
        ctx,
        input: { organizationId, domain, verifiedAt: new Date() },
      });
    } else {
      await removeSsoDomain({ ctx, input: { organizationId, domain } });
    }
  } catch (error) {
    // An organization with no mapped workspace is not worth retrying:
    // acknowledge so WorkOS stops redelivering.
    if (error instanceof NotFoundError) {
      return new Response("OK", { status: 200 });
    }
    throw error;
  }

  return new Response("OK", { status: 200 });
}
