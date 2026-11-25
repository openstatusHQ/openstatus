import { HydrateClient } from "@/lib/trpc/server";

import { Client } from "./client";

// `page.list` is prefetched by the root layout for the sidebar.
export default function Page() {
  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
