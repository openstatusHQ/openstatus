import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";
import { registerGetStatusReportUpdate } from "./get";
import { registerPostStatusReportUpdate } from "./post";
import { handleZodError } from "../../libs/errors";

export const statusReportUpdatesApi = new OpenAPIHono<{
  Variables: Variables;
}>({
  defaultHook: handleZodError,
});

registerGetStatusReportUpdate(statusReportUpdatesApi);
registerPostStatusReportUpdate(statusReportUpdatesApi);
