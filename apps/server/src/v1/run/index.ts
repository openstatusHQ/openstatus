import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";

import { handleZodError } from "../../libs/errors";

const runAPI = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

// registerSingRunPost(runAPI);

export { runAPI };
