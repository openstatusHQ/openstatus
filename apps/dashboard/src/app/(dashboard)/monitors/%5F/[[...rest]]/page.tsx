import { HydrateClient } from "@/lib/trpc/server";

import { Client } from "./client";

// `monitor.list` is prefetched by the root layout for the sidebar.
export default function Page() {
  return (
    <HydrateClient>
      <Client />
    </HydrateClient>
  );
}
