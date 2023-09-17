import Link from "next/link";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { api } from "@/trpc/server";

export default async function VercelDashboard({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const integrations = await api.integration.getAllIntegrations.query({
    workspaceSlug: params.workspaceSlug,
  });

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header title="Projects" description="Select your Vercel Project" />

      {integrations?.map((integration) => {
        return (
          <Link href={`vercel/${integration.id}`} key={integration.id}>
            <Container key={integration.id} title={integration.id} />
          </Link>
        );
      })}
    </div>
  );
}
// getAllIntegrations
// export default VercelDashboardPage
