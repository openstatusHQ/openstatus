import { OpenAPIHono } from "@hono/zod-openapi";

import { handleZodError } from "@/libs/errors";
import type { Variables } from "../index";
import { registerDeleteMonitor } from "./delete";
import { registerGetMonitor } from "./get";
import { registerGetAllMonitors } from "./get_all";
import { registerPostMonitor } from "./post";
import { registerPostMonitorHTTP } from "./post_http";
import { registerPostMonitorTCP } from "./post_tcp";
import { registerPutMonitor } from "./put";
import { registerPutHTTPMonitor } from "./put_http";
import { registerPutTCPMonitor } from "./put_tcp";
import { registerGetMonitorResult } from "./results/get";
import { registerRunMonitor } from "./run/post";
import { registerGetMonitorSummary } from "./summary/get";
import { registerTriggerMonitor } from "./trigger/post";

const monitorsApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerGetAllMonitors(monitorsApi);
registerGetMonitor(monitorsApi);
registerPutMonitor(monitorsApi);
registerDeleteMonitor(monitorsApi);
registerPostMonitor(monitorsApi);
registerPostMonitorHTTP(monitorsApi);
registerPostMonitorTCP(monitorsApi);
registerPutHTTPMonitor(monitorsApi);
registerPutTCPMonitor(monitorsApi);
//
registerGetMonitorSummary(monitorsApi);
registerTriggerMonitor(monitorsApi);
registerGetMonitorResult(monitorsApi);
registerRunMonitor(monitorsApi);

export { monitorsApi };
