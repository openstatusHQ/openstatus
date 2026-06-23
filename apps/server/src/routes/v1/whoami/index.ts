import { OpenAPIHono } from "@hono/zod-openapi";

import { handleZodError } from "../../../libs/errors";

import type { Variables } from "..";
import { registerGetWhoami } from "./get";

export const whoamiApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerGetWhoami(whoamiApi);
