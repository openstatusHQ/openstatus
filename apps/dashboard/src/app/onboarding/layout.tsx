import { HydrateClient, batchPrefetch, trpc } from "@/lib/trpc/server";

export default function Layout({ children }: { children: React.ReactNode }) {
  batchPrefetch([
    trpc.workspace.get.queryOptions(),
    trpc.user.get.queryOptions(),
    trpc.monitor.list.queryOptions(),
    trpc.page.list.queryOptions(),
  ]);

  return <HydrateClient>{children}</HydrateClient>;
}
