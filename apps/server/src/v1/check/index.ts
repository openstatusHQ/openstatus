import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";

import { handleZodError } from "../../libs/errors";
import { registerPostCheck } from "./post";

const checkAPI = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerPostCheck(checkAPI);

export { checkAPI };
