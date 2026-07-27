import { redirect } from "next/navigation";
import type { SearchParams } from "nuqs";

import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server";

import { Client } from "./client";
import { searchParamsCache } from "./search-params";

export default async function InvitePage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await searchParamsCache.parse(props.searchParams);

  if (!token) {
    return redirect("/overview");
  }

  prefetch(trpc.invitation.get.queryOptions({ token }));

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
