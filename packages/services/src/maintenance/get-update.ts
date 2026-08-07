import { db as defaultDb } from "@openstatus/db";

import type { ServiceContext } from "../context";
import type { MaintenanceUpdate } from "../types";
import { getMaintenanceUpdateInWorkspace } from "./internal";
import { GetMaintenanceUpdateInput } from "./schemas";

export async function getMaintenanceUpdate(args: {
  ctx: ServiceContext;
  input: GetMaintenanceUpdateInput;
}): Promise<MaintenanceUpdate> {
  const { ctx } = args;
  const input = GetMaintenanceUpdateInput.parse(args.input);
  return getMaintenanceUpdateInWorkspace({
    tx: ctx.db ?? defaultDb,
    id: input.id,
    workspaceId: ctx.workspace.id,
  });
}
