import { OpenAPIHono } from "@hono/zod-openapi";

import { handleZodError } from "../../libs/errors";
import type { Variables } from "../index";
import { registerDeleteMonitor } from "./delete";
import { registerGetMonitor } from "./get";
import { registerGetAllMonitors } from "./get_all";
import { registerPostMonitor } from "./post";
import { registerPutMonitor } from "./put";
import { registerGetMonitorSummary } from "./summary/get";

const monitorsApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerGetAllMonitors(monitorsApi);
registerGetMonitor(monitorsApi);
registerPutMonitor(monitorsApi);
registerDeleteMonitor(monitorsApi);
registerGetMonitorSummary(monitorsApi);
registerPostMonitor(monitorsApi);

export { monitorsApi };
