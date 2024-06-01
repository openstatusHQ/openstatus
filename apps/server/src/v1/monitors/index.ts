import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";
import { registerGetAllMonitors } from "./get_all";
import { registerGetMonitor } from "./get";
import { registerPutMonitor } from "./put";
import { registerDeleteMonitor } from "./delete";
import { registerGetMonitorSummary } from "./summary/get";

const monitorsApi = new OpenAPIHono<{ Variables: Variables }>();

registerGetAllMonitors(monitorsApi);
registerGetMonitor(monitorsApi);
registerPutMonitor(monitorsApi);
registerDeleteMonitor(monitorsApi);
registerGetMonitorSummary(monitorsApi);

export { monitorsApi };
