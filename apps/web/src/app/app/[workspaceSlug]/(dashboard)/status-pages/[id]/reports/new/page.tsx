import { StatusReportForm } from "@/components/forms/status-report/form";
import { api } from "@/trpc/server";

export default async function NewPage(props: {
  params: Promise<{ id: string; reportId: string }>;
}) {
  const params = await props.params;
  const monitors = await api.monitor.getMonitorsByWorkspace.query();

  return (
    <StatusReportForm
      monitors={monitors}
      nextUrl={"./"}
      defaultSection="update-message"
      pageId={Number.parseInt(params.id)}
    />
  );
}
