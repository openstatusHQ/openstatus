import { HydrateClient, fetchQueryOrNotFound, trpc } from "@/lib/trpc/server";

export default async function Layout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string; maintenanceId: string }>;
}) {
  const { id, maintenanceId } = await params;
  await Promise.all([
    fetchQueryOrNotFound(
      trpc.maintenance.get.queryOptions({
        id: Number.parseInt(maintenanceId),
      }),
    ),
    fetchQueryOrNotFound(
      trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
    ),
  ]);
  return <HydrateClient>{children}</HydrateClient>;
}
