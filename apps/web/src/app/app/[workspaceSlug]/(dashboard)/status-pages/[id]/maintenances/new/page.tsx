import { MaintenanceForm } from "@/components/forms/maintenance/form";
import { api } from "@/trpc/server";

export default async function MaintenancePage({
  params,
}: {
  params: { workspaceSlug: string; id: string };
}) {
  const monitors = await api.monitor.getMonitorsByPageId.query({
    id: Number(params.id),
  });

  return (
    <MaintenanceForm
      nextUrl="./" // back to the overview page
      defaultSection="connect"
      pageId={Number(params.id)}
      monitors={monitors}
    />
  );
}
