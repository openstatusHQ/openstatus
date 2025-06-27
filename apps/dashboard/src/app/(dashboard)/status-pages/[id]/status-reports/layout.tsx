import { SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "../sidebar";
import { HydrateClient, trpc, getQueryClient } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const queryClient = getQueryClient();
  const { id } = await params;
  await queryClient.prefetchQuery(
    trpc.statusReport.list.queryOptions({ pageId: parseInt(id) })
  );

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
