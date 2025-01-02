import { OpenAPIHono } from "@hono/zod-openapi";

import { handleZodError } from "@/libs/errors";
import type { Variables } from "../index";
import { registerGetPage } from "./get";
import { registerGetAllPages } from "./get_all";
import { registerPostPage } from "./post";
import { registerPutPage } from "./put";

export const pagesApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerGetPage(pagesApi);
registerGetAllPages(pagesApi);
registerPutPage(pagesApi);
registerPostPage(pagesApi);
