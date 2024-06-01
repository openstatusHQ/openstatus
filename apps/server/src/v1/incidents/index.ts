import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";
import { registerGetAllIncidents } from "./get_all";
import { registerGetIncident } from "./get";
import { registerPutIncident } from "./put";

const incidentsApi = new OpenAPIHono<{ Variables: Variables }>();

registerGetAllIncidents(incidentsApi);
registerGetIncident(incidentsApi);
registerPutIncident(incidentsApi);

export { incidentsApi };
