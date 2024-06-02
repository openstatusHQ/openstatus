import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";
import { registerGetAllStatusReports } from "./get_all";
import { registerDeleteStatusReport } from "./delete";
import { regsiterGetStatusReport } from "./get";
import { registerPostStatusReport } from "./post";

export const statusReportsApi = new OpenAPIHono<{ Variables: Variables }>();

registerGetAllStatusReports(statusReportsApi);
registerDeleteStatusReport(statusReportsApi);
regsiterGetStatusReport(statusReportsApi);
registerPostStatusReport(statusReportsApi);
