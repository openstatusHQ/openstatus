import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";

export const statusReportsApi = new OpenAPIHono<{ Variables: Variables }>();
