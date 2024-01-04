import { StatusPageForm } from "@/components/forms/status-page-form";
import { api } from "@/trpc/server";

export default async function Page() {
  const allMonitors = await api.monitor.getMonitorsByWorkspace.query();

  return (
    <StatusPageForm
      allMonitors={allMonitors} // FIXME: rename to just 'monitors'
      nextUrl="./" // back to the overview page
    />
  );
}
