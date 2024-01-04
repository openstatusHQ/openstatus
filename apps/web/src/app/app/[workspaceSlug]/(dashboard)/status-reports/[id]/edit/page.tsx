import { StatusReportForm } from "@/components/forms/status-report-form";
import { api } from "@/trpc/server";

export default async function EditPage({
  params,
}: {
  params: { workspaceSlug: string; id: string };
}) {
  const statusUpdate = await api.statusReport.getStatusReportById.query({
    id: parseInt(params.id),
  });

  const monitors = await api.monitor.getMonitorsByWorkspace.query();

  const pages = await api.page.getPagesByWorkspace.query();

  return (
    <StatusReportForm
      monitors={monitors}
      pages={pages}
      defaultValues={
        // TODO: we should move the mapping to the trpc layer
        // so we don't have to do this in the UI
        // it should be something like defaultValues={statusReport}
        {
          ...statusUpdate,
          monitors: statusUpdate?.monitorsToStatusReports.map(
            ({ monitorId }) => monitorId,
          ),
          pages: statusUpdate?.pagesToStatusReports.map(({ pageId }) => pageId),
          message: "",
        }
      }
    />
  );
}
