import { count, desc, eq } from "@openstatus/db";
import { privateLocation } from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb } from "../context";
import { ListPrivateLocationsInput } from "./schemas";

const LIMIT_DEFAULT = 50;

/**
 * List private locations in the caller's workspace, each one flattened to
 * include the monitors it's attached to (the relational join's `monitor`
 * link lifted onto `monitors`, filtered to non-null).
 *
 * Return type is deliberately inferred from drizzle's relational query
 * rather than annotated: pulling the shape out of `@openstatus/db`'s
 * `selectMonitorSchema` narrows columns (e.g. `regions`) in ways the raw
 * row doesn't, producing a false-positive type mismatch.
 */
export async function listPrivateLocations(args: {
  ctx: ServiceContext;
  input?: ListPrivateLocationsInput;
}) {
  const input = ListPrivateLocationsInput.parse(args.input ?? {});
  const db = getReadDb(args.ctx);

  const rows = await db.query.privateLocation.findMany({
    where: eq(privateLocation.workspaceId, args.ctx.workspace.id),
    with: {
      privateLocationToMonitors: {
        with: { monitor: true },
      },
    },
    orderBy: desc(privateLocation.id),
    limit: input.limit ?? LIMIT_DEFAULT,
    offset: input.offset ?? 0,
  });

  const total = await db
    .select({ count: count() })
    .from(privateLocation)
    .where(eq(privateLocation.workspaceId, args.ctx.workspace.id))
    .get();

  return {
    items: rows.map((row) => ({
      ...row,
      monitors: row.privateLocationToMonitors
        .map((link) => link.monitor)
        .filter((m) => m !== null),
    })),
    totalSize: total?.count ?? 0,
  };
}
