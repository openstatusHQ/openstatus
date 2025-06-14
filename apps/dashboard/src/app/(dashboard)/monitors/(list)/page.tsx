import { getQueryClient, HydrateClient, trpc } from "@/lib/trpc/server";
import { Client } from "./client";

export default async function Page() {
  const queryClient = getQueryClient();

  await queryClient.prefetchQuery(trpc.monitor.list.queryOptions());

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
