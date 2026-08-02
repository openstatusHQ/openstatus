import { HydrateClient, prefetch, trpc } from "@/lib/trpc/server";

import { Client } from "./client";

export default function Page() {
  prefetch(trpc.page.list.queryOptions());

  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
