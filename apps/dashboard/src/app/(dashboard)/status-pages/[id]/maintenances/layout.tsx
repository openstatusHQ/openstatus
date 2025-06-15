import { SidebarProvider } from "@/components/ui/sidebar";
import { Sidebar } from "../sidebar";
import { trpc, HydrateClient, getQueryClient } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const queryClient = await getQueryClient();

  await queryClient.prefetchQuery(
    trpc.maintenance.list.queryOptions({
      pageId: parseInt(id),
    })
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
