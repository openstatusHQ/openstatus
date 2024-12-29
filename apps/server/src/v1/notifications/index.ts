import { OpenAPIHono } from "@hono/zod-openapi";

import { handleZodError } from "@/libs/errors";
import type { Variables } from "../index";
import { registerGetNotification } from "./get";
import { registerGetAllNotifications } from "./get_all";
import { registerPostNotification } from "./post";

export const notificationsApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerGetAllNotifications(notificationsApi);
registerGetNotification(notificationsApi);
registerPostNotification(notificationsApi);
