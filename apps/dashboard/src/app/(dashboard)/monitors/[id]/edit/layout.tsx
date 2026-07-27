import { HydrateClient, batchPrefetch, trpc } from "@/lib/trpc/server";

export default function Layout({ children }: { children: React.ReactNode }) {
  batchPrefetch([
    trpc.monitorTag.list.queryOptions(),
    trpc.privateLocation.list.queryOptions(),
  ]);

  return <HydrateClient>{children}</HydrateClient>;
}
