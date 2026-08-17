import { and, eq } from "@openstatus/db";
import { privateLocation } from "@openstatus/db/src/schema";

import { type ServiceContext, getReadDb } from "../context";
import { NotFoundError } from "../errors";
import { GetPrivateLocationInput } from "./schemas";

/**
 * Fetch one private location in the caller's workspace, flattened the same
 * way `listPrivateLocations` flattens its items.
 *
 * Return type is deliberately inferred — see the note in `list.ts`.
 */
export async function getPrivateLocation(args: {
  ctx: ServiceContext;
  input: GetPrivateLocationInput;
}) {
  const input = GetPrivateLocationInput.parse(args.input);
  const db = getReadDb(args.ctx);

  const row = await db.query.privateLocation.findFirst({
    where: and(
      eq(privateLocation.id, input.id),
      eq(privateLocation.workspaceId, args.ctx.workspace.id),
    ),
    with: {
      privateLocationToMonitors: {
        with: { monitor: true },
      },
    },
  });

  if (!row) throw new NotFoundError("private_location", input.id);

  return {
    ...row,
    monitors: row.privateLocationToMonitors
      .map((link) => link.monitor)
      .filter((m) => m !== null),
  };
}
