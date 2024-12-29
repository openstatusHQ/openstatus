import { OpenAPIHono } from "@hono/zod-openapi";

import { handleZodError } from "@/libs/errors";
import type { Variables } from "../index";
import { registerGetIncident } from "./get";
import { registerGetAllIncidents } from "./get_all";
import { registerPutIncident } from "./put";

const incidentsApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerGetAllIncidents(incidentsApi);
registerGetIncident(incidentsApi);
registerPutIncident(incidentsApi);

export { incidentsApi };
