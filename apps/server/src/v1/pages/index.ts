import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";
import { registerGetPage } from "./get";
import { registerGetAllPages } from "./get_all";
import { registerPutPage } from "./put";
import { registerPostPage } from "./post";
import { handleZodError } from "../../libs/errors";

export const pagesApi = new OpenAPIHono<{ Variables: Variables }>({
  defaultHook: handleZodError,
});

registerGetPage(pagesApi);
registerGetAllPages(pagesApi);
registerPutPage(pagesApi);
registerPostPage(pagesApi);
