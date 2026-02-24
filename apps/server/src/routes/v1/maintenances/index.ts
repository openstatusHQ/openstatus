import type { Variables } from "../index";

import { OpenAPIHono } from "@hono/zod-openapi";

import { handleZodError } from "@/libs/errors";

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
