import { SearchParams } from "nuqs/server";
import { Client } from "./client";
import { searchParamsCache } from "./search-params";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  // NOTE: store in cache to avoid flicker on clients first render
  await searchParamsCache.parse(searchParams);

  return <Client />;
}
