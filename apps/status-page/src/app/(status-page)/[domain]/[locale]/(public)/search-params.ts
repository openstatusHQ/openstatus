import { createSearchParamsCache } from "nuqs/server";

import { embedParser } from "@/lib/embed-params";

export const embedSearchParamsCache = createSearchParamsCache({
  embed: embedParser,
});
