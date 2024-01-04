import { notFound } from "next/navigation";

import { ProFeatureAlert } from "@/components/billing/pro-feature-alert";
import { api } from "@/trpc/server";

export default async function CustomDomainPage({
  params,
}: {
  params: { workspaceSlug: string; id: string };
}) {
  const id = Number(params.id);
  const page = await api.page.getPageById.query({ id });
  const workspace = await api.workspace.getWorkspace.query();

  const isProPlan = workspace?.plan === "pro";

  if (!page) return notFound();

  if (!isProPlan)
    return <ProFeatureAlert feature={"Status page subscribers"} />;

  // TODO: add page-subscribers trpc endpoint first
  return (
    <p className="text-muted-foreground text-sm">
      Your users can subscribe to status report updates. A list with more
      detailed informations coming soon.
    </p>
  );
}
