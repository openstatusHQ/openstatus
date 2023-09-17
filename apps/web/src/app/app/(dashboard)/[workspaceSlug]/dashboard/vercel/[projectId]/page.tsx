import { VercelDashboardPage } from "@openstatus/vercel";

import { api } from "@/trpc/server";

export default async function VercelDashboard({
  params,
}: {
  params: { workspaceSlug: string; projectId: string };
}) {
  const integrations = await api.integration.getIntegration.query({
    workspaceSlug: params.workspaceSlug,
    integrationId: params.projectId,
  });

  return (
    <>
      {integrations && integrations?.externalId && (
        <VercelDashboardPage params={{ projectId: integrations?.externalId }} />
      )}
    </>
  );
}
