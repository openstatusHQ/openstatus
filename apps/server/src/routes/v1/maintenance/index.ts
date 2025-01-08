import { OpenAPIHono } from "@hono/zod-openapi";
import { handleZodError } from "@/libs/errors";
import type { Variables } from "../index";
import { registerGetMaintenance } from "./get";
import { registerGetAllMaintenances } from "./get_all";
import { registerPostMaintenance } from "./post";
import { registerPutMaintenance } from "./put";

const maintenanceApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerGetAllMaintenances(maintenanceApi);
registerGetMaintenance(maintenanceApi);
registerPostMaintenance(maintenanceApi);
registerPutMaintenance(maintenanceApi);

export { maintenanceApi };
