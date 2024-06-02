import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";
import { registerPostPageSubscriber } from "./post";

export const pageSubscribersApi = new OpenAPIHono<{ Variables: Variables }>();

registerPostPageSubscriber(pageSubscribersApi);
