import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";
import { registerGetStatusReportUpdate } from "./get";
import { registerPostStatusReportUpdate } from "./post";

export const statusReportUpdatesApi = new OpenAPIHono<{
  Variables: Variables;
}>();

registerGetStatusReportUpdate(statusReportUpdatesApi);
registerPostStatusReportUpdate(statusReportUpdatesApi);
