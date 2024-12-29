import { OpenAPIHono } from "@hono/zod-openapi";

import { handleZodError } from "@/libs/errors";
import type { Variables } from "../index";
import { registerDeleteStatusReport } from "./delete";
import { regsiterGetStatusReport } from "./get";
import { registerGetAllStatusReports } from "./get_all";
import { registerPostStatusReport } from "./post";
import { registerStatusReportUpdateRoutes } from "./update/post";

export const statusReportsApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerGetAllStatusReports(statusReportsApi);
registerDeleteStatusReport(statusReportsApi);
regsiterGetStatusReport(statusReportsApi);
registerPostStatusReport(statusReportsApi);

/**
 * @deprecated in favor of `/status_report_updates`
 */
registerStatusReportUpdateRoutes(statusReportsApi);
