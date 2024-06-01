import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";

export const notificationsApi = new OpenAPIHono<{ Variables: Variables }>();
