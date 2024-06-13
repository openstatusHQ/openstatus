import { StatusReportForm } from "@/components/forms/status-report/form";
import { api } from "@/trpc/server";

export default async function NewPage() {
  const monitors = await api.monitor.getMonitorsByWorkspace.query();

  const pages = await api.page.getPagesByWorkspace.query();

  return (
    <StatusReportForm
      monitors={monitors}
      pages={pages}
      nextUrl={"./"}
      defaultSection="update-message"
    />
  );
}
