import { MaintenanceForm } from "@/components/forms/maintenance/form";
import { api } from "@/trpc/server";

export default async function MaintenancePage(props: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const params = await props.params;
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
