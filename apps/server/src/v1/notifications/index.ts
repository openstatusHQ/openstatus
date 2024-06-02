import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";
import { registerGetAllNotifications } from "./get_all";
import { registerGetNotification } from "./get";
import { registerPostNotification } from "./post";
import { handleZodError } from "../../libs/errors";

export const notificationsApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerGetAllNotifications(notificationsApi);
registerGetNotification(notificationsApi);
registerPostNotification(notificationsApi);
