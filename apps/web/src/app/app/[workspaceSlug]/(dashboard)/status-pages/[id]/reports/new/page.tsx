import { StatusReportForm } from "@/components/forms/status-report/form";
import { api } from "@/trpc/server";

export default async function NewPage({
  params,
}: {
  params: { id: string; reportId: string };
}) {
  const monitors = await api.monitor.getMonitorsByWorkspace.query();

  return (
    <StatusReportForm
      // TODO: add defaultValues or pageId
      nextUrl={"./"}
      defaultSection="update-message"
    />
  );
}
