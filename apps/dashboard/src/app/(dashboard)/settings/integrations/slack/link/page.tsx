import { redirect } from "next/navigation";
import type { SearchParams } from "nuqs";

import { Client } from "./client";
import { searchParamsCache } from "./search-params";

export default async function SlackLinkPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await searchParamsCache.parse(props.searchParams);
  if (!token) return redirect("/settings/integrations");
  return <Client />;
}
