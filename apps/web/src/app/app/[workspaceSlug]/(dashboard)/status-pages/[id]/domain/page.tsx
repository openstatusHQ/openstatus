import { notFound } from "next/navigation";

import { allPlans } from "@openstatus/db/src/schema/plan/config";

import { ProFeatureAlert } from "@/components/billing/pro-feature-alert";
import { CustomDomainForm } from "@/components/forms/custom-domain-form";
import { api } from "@/trpc/server";

export default async function CustomDomainPage(props: {
  params: Promise<{ workspaceSlug: string; id: string }>;
}) {
  const params = await props.params;
  const id = Number(params.id);
  const page = await api.page.getPageById.query({ id });
  const workspace = await api.workspace.getWorkspace.query();

  const isValid = workspace.limits["custom-domain"];

  if (!page) return notFound();

  if (!isValid) return <ProFeatureAlert feature="Custom domains" />;

  return (
    <CustomDomainForm
      defaultValues={{
        customDomain: page.customDomain,
        id: page.id,
      }}
    />
  );
}
