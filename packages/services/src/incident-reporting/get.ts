import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { findIncidentSlaPolicy } from "./internal";

/** The workspace's policy, or null. Readable without the limit so a downgraded workspace can still turn it off. */
export async function getIncidentSlaPolicy(args: { ctx: ServiceContext }) {
  const { ctx } = args;
  requireScope(ctx, "incidents:read");
  return findIncidentSlaPolicy(getReadDb(ctx), ctx.workspace.id);
}
