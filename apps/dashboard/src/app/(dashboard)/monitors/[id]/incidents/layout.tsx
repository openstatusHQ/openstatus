import { SidebarProvider } from "@/components/ui/sidebar";
import { getQueryClient, trpc } from "@/lib/trpc/server";
import { Sidebar } from "../sidebar";

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
    trpc.incident.list.queryOptions({ monitorId: Number.parseInt(id) }),
  );

  return (
    <SidebarProvider defaultOpen={false}>
      <div className="w-full flex-1">{children}</div>
      <div className="hidden lg:block">
        <Sidebar />
      </div>
    </SidebarProvider>
  );
}
