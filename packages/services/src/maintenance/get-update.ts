import { type ServiceContext, getReadDb } from "../context";
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
    tx: getReadDb(ctx),
    id: input.id,
    workspaceId: ctx.workspace.id,
  });
}
