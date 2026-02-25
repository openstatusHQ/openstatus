import type { Variables } from "../index";

import { OpenAPIHono } from "@hono/zod-openapi";

import { handleZodError } from "@/libs/errors";

import { registerPostPageSubscriber } from "./post";

export const pageSubscribersApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerPostPageSubscriber(pageSubscribersApi);
