import { OpenAPIHono } from "@hono/zod-openapi";
import type { Variables } from "..";
import { handleZodError } from "../../libs/errors";

export const whoamiApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
}); // Compare this snippet from apps/server/src/v1/whoami/index.ts:
