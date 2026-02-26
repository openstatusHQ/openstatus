import type { Variables } from "../index";

import { OpenAPIHono } from "@hono/zod-openapi";

import { handleZodError } from "@/libs/errors";

import { registerHTTPPostCheck } from "./http/post";

const checkApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerHTTPPostCheck(checkApi);

export { checkApi };
