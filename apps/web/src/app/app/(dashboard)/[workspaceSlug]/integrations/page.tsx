"use client";

import * as React from "react";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { api } from "@/trpc/client";

export default async function IncidentPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  const workspace = await api.workspace.getWorkspace.query({
    slug: params.workspaceSlug,
  });

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
