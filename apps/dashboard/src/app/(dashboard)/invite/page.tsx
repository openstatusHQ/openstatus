import { SearchParams } from "nuqs";
import { searchParamsCache } from "./search-params";
import { Client } from "./client";
import { getQueryClient, HydrateClient, trpc } from "@/lib/trpc/server";
import { redirect } from "next/navigation";

export default async function InvitePage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await searchParamsCache.parse(props.searchParams);

  if (!token) {
    return redirect("/overview");
  }

  const queryClient = getQueryClient();
  await queryClient.prefetchQuery(trpc.invitation.get.queryOptions({ token }));

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
