import { ProFeatureAlert } from "@/components/billing/pro-feature-alert";
import { NotificationForm } from "@/components/forms/notification-form";
import { api } from "@/trpc/server";
import { PagerDutySchema } from "@openstatus/notification-pagerduty";
import { getLimit } from "@openstatus/plans";
import { z } from "zod";

// REMINDER: PagerDuty requires a different workflow, thus the separate page

const searchParamsSchema = z.object({
  config: z.string().optional(),
});

export default async function PagerDutyPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const workspace = await api.workspace.getWorkspace.query();
  const params = searchParamsSchema.parse(searchParams);

  if (!params.config) {
    return <div>Invalid data</div>;
  }

  const data = PagerDutySchema.parse(JSON.parse(params.config));
  if (!data) {
    return <div>Invalid data</div>;
  }

  const allowed = getLimit(workspace.plan, "pagerduty");

  if (!allowed) return <ProFeatureAlert feature="SMS channel notification" />;

  return (
    <>
      <NotificationForm
        workspacePlan={workspace.plan}
        nextUrl="../"
        provider="pagerduty"
        callbackData={params.config}
      />
    </>
  );
}
