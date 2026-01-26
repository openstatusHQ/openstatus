import { SidebarProvider } from "@/components/ui/sidebar";
import { HydrateClient, getQueryClient, trpc } from "@/lib/trpc/server";
import { Sidebar } from "../sidebar";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = getQueryClient();

  await Promise.all([
    queryClient.prefetchQuery(
      trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
    ),
    queryClient.prefetchQuery(trpc.monitor.list.queryOptions()),
    queryClient.prefetchQuery(
      trpc.pageComponent.list.queryOptions({ pageId: Number.parseInt(id) }),
    ),
  ]);

  return (
    <HydrateClient>
      <SidebarProvider defaultOpen={false}>
        <div className="w-full flex-1">{children}</div>
        <div className="hidden lg:block">
          <Sidebar />
        </div>
      </SidebarProvider>
    </HydrateClient>
  );
}
