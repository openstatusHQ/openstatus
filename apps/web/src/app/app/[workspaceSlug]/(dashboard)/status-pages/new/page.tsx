import { redirect } from "next/navigation";

import { StatusPageForm } from "@/components/forms/status-page/form";
import { api } from "@/trpc/server";

export default async function Page() {
  const allMonitors = await api.monitor.getMonitorsByWorkspace.query();
  const isLimitReached = await api.page.isPageLimitReached.query();

  if (isLimitReached) return redirect("./");

  return (
    <StatusPageForm
      allMonitors={allMonitors} // FIXME: rename to just 'monitors'
      nextUrl="./" // back to the overview page
      defaultSection="monitors"
    />
  );
}
