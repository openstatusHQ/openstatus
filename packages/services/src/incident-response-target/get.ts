import { requireScope } from "../auth";
import { getReadDb, type ServiceContext } from "../context";
import { findIncidentResponseTarget } from "./internal";

/** The workspace's policy, or null. Readable without the limit so a downgraded workspace can still turn it off. */
export async function getIncidentResponseTarget(args: { ctx: ServiceContext }) {
  const { ctx } = args;
  requireScope(ctx, "incidents:read");
  return findIncidentResponseTarget(getReadDb(ctx), ctx.workspace.id);
}
