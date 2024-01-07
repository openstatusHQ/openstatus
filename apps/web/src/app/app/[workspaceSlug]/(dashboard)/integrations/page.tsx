import * as React from "react";

import { Button } from "@openstatus/ui";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { api } from "@/trpc/server";

export default async function IntegrationPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = await api.workspace.getWorkspace.query();

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header title="Integrations" description="All our integrations" />
      <Container
        title="Vercel"
        key={"vercel"}
        description="Connect your Vercel Project get insights."
        actions={[
          <a
            href={
              workspace?.id === 1
                ? "https://vercel.com/integrations/openstatus/new"
                : "#"
            }
            // biome-ignore lint/a11y/noBlankTarget:
            target="_blank"
            key={"vercel"}
          >
            <Button>{workspace?.id === 1 ? "Configure" : "Coming soon"}</Button>
          </a>,
        ]}
      ></Container>
    </div>
  );
}
