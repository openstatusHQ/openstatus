import { handleZodError } from "@/libs/errors";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Variables } from "../index";
import { registerGetMaintenance } from "./get";
import { registerGetAllMaintenances } from "./get_all";
import { registerPostMaintenance } from "./post";
import { registerPutMaintenance } from "./put";

const maintenancesApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerGetAllMaintenances(maintenancesApi);
registerGetMaintenance(maintenancesApi);
registerPostMaintenance(maintenancesApi);
registerPutMaintenance(maintenancesApi);

export { maintenancesApi };
