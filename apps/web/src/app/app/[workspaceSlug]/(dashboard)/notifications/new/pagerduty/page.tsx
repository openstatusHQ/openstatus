import { ProFeatureAlert } from "@/components/billing/pro-feature-alert";
import { NotificationForm } from "@/components/forms/notification/form";
import { api } from "@/trpc/server";
import { getLimit } from "@openstatus/db/src/schema/plan/utils";
import { PagerDutySchema } from "@openstatus/notification-pagerduty";

import { searchParamsCache } from "./search-params";

// REMINDER: PagerDuty requires a different workflow, thus the separate page

export default async function PagerDutyPage(props: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const searchParams = await props.searchParams;
  const workspace = await api.workspace.getWorkspace.query();
  const monitors = await api.monitor.getMonitorsByWorkspace.query();
  const params = searchParamsCache.parse(searchParams);

  if (!params.config) {
    return <div>Invalid data</div>;
  }

  const data = PagerDutySchema.parse(JSON.parse(params.config));
  if (!data) {
    return <div>Invalid data</div>;
  }

  const allowed = getLimit(workspace.limits, "pagerduty");
  if (!allowed)
    return <ProFeatureAlert feature="PagerDuty channel notification" />;

  return (
    <>
      <NotificationForm
        workspacePlan={workspace.plan}
        nextUrl="../"
        provider="pagerduty"
        callbackData={params.config}
        monitors={monitors}
      />
    </>
  );
}
