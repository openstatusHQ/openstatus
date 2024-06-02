import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";
import { registerPostPageSubscriber } from "./post";
import { handleZodError } from "../../libs/errors";

export const pageSubscribersApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerPostPageSubscriber(pageSubscribersApi);
