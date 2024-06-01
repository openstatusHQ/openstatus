import { OpenAPIHono } from "@hono/zod-openapi";

import type { Variables } from "../index";
import { registerGetPage } from "./get";
import { registerGetAllPages } from "./get_all";
import { registerPutPage } from "./put";
import { registerPostPage } from "./post";
import { registerPostPageSubscriber } from "./update/post";

export const pagesApi = new OpenAPIHono<{ Variables: Variables }>();

registerGetPage(pagesApi);
registerGetAllPages(pagesApi);
registerPutPage(pagesApi);
registerPostPage(pagesApi);
registerPostPageSubscriber(pagesApi);
