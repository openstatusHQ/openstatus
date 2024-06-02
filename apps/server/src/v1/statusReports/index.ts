import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";
import { registerGetAllStatusReports } from "./get_all";
import { registerDeleteStatusReport } from "./delete";
import { regsiterGetStatusReport } from "./get";
import { registerPostStatusReport } from "./post";
import { handleZodError } from "../../libs/errors";
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
