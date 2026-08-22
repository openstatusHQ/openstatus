import { OpenAPIHono } from "@hono/zod-openapi";

import { handleZodError } from "@/libs/errors";

import type { Variables } from "../index";
import { registerDeleteMaintenanceUpdate } from "./delete";
import { registerGetMaintenanceUpdate } from "./get";
import { registerPostMaintenanceUpdate } from "./post";
import { registerPutMaintenanceUpdate } from "./put";

export const maintenanceUpdatesApi = new OpenAPIHono<{
  Variables: Variables;
}>({
  defaultHook: handleZodError,
});

registerGetMaintenanceUpdate(maintenanceUpdatesApi);
registerPostMaintenanceUpdate(maintenanceUpdatesApi);
registerPutMaintenanceUpdate(maintenanceUpdatesApi);
registerDeleteMaintenanceUpdate(maintenanceUpdatesApi);
