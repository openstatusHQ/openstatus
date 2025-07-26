import { Client } from "./client";
import { searchParamsCache } from "./search-params";

import type { SearchParams } from "nuqs";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await searchParamsCache.parse(searchParams);

  return <Client />;
}
