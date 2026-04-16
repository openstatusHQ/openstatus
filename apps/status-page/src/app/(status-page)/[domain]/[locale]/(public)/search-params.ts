import { embedParser } from "@/lib/embed-params";
import { createSearchParamsCache } from "nuqs/server";

export const embedSearchParamsCache = createSearchParamsCache({
  embed: embedParser,
});
