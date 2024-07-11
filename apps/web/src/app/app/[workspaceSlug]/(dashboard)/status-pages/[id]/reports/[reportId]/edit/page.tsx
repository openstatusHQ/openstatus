import { StatusReportForm } from "@/components/forms/status-report/form";
import { api } from "@/trpc/server";

export default async function EditPage({
  params,
}: {
  params: { workspaceSlug: string; id: string; reportId: string };
}) {
  const statusUpdate = await api.statusReport.getStatusReportById.query({
    id: Number.parseInt(params.reportId),
  });

  const monitors = await api.monitor.getMonitorsByWorkspace.query();

  return (
    <StatusReportForm
      monitors={monitors}
      defaultValues={
        // TODO: we should move the mapping to the trpc layer
        // so we don't have to do this in the UI
        // it should be something like defaultValues={statusReport}
        {
          ...statusUpdate,
          monitors: statusUpdate?.monitorsToStatusReports.map(
            ({ monitorId }) => monitorId
          ),
          pages: [Number.parseInt(params.id)],
          message: "",
        }
      }
      defaultSection="connect"
    />
  );
}
