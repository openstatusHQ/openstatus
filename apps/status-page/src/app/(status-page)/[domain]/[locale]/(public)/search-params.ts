import { iframeParser } from "@/lib/iframe-params";
import { createSearchParamsCache } from "nuqs/server";

export const iframeSearchParamsCache = createSearchParamsCache({
  iframe: iframeParser,
});
