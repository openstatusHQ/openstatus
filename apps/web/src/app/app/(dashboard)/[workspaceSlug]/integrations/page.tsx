"use client";

import * as React from "react";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { Button } from "@/components/ui/button";

export default async function IncidentPage({
  params,
}: {
  params: { workspaceSlug: string };
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <Header title="Integrations" description="All our integrations"></Header>

      <Container
        title="Vercel"
        actions={[
          <a
            href="https://vercel.com/integrations/openstatus-staging/new"
            target="_blank"
          >
            <Button>Configure</Button>,
          </a>,
        ]}
      >
        <div className="text-foreground-secondary text-sm">
          Connect your Vercel Project get insights.
        </div>
      </Container>
    </div>
  );
}
