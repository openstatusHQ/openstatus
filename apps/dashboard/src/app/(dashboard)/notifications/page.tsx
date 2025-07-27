import type { SearchParams } from "nuqs";
import { Client } from "./client";
import { searchParamsCache } from "./search-params";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await searchParamsCache.parse(searchParams);
  return <Client />;
}
