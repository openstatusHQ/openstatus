import { StatusReportForm } from "@/components/forms/status-report/form";
import { api } from "@/trpc/server";

export default async function EditPage(props: {
  params: Promise<{ workspaceSlug: string; id: string; reportId: string }>;
}) {
  const params = await props.params;
  const statusUpdate = await api.statusReport.getStatusReportById.query({
    id: Number.parseInt(params.reportId),
    pageId: Number.parseInt(params.id),
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
            ({ monitorId }) => monitorId,
          ),
          message: "",
        }
      }
      pageId={Number.parseInt(params.id)}
      defaultSection="connect"
    />
  );
}
