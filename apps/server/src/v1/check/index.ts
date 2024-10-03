import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";

import { handleZodError } from "../../libs/errors";
import { registerHTTPPostCheck } from "./http/post";

const checkAPI = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerHTTPPostCheck(checkAPI);

export { checkAPI };
