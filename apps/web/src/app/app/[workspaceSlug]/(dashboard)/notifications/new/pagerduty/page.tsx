import { NotificationForm } from "@/components/forms/notification-form";
import { api } from "@/trpc/server";
import { PagerDutySchema } from "@openstatus/notification-pagerduty";
import { z } from "zod";

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

  if (workspace.plan === "free") {
    return <div> Update your account</div>;
  }

  return (
    <>
      <NotificationForm
        workspacePlan={workspace.plan}
        nextUrl="../"
        provider="pagerduty"
        d={params.config}
      />
    </>
  );
}
