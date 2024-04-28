import * as React from "react";
import { notFound } from "next/navigation";

import { EmptyState } from "@/components/dashboard/empty-state";
import { api } from "@/trpc/server";

import { RUMMetricCard } from "./_components/rum-metric-card";
import { Button } from "@openstatus/ui";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function RUMPage() {
  const workspace = await api.workspace.getWorkspace.query();

  if (!workspace) {
    return notFound();
  }

  if (workspace.dsn === null) {
    return (
      <EmptyState 
        icon="ratio"
        title="Real User Monitoring"
        description="The feature is currently in beta and will be released soon."
        action={
          <Button asChild>
            <Link 
              href="mailto:ping@openstatus.dev?subject=Real User Monitoring beta tester" 
              target="_blank"
            >
              Contact Us
            </Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid  grid-cols-1 gap-2 md:grid-cols-4">
      <RUMMetricCard event="CLS" />
      <RUMMetricCard event="FCP" />
      <RUMMetricCard event="FID" />
      <RUMMetricCard event="INP" />
      <RUMMetricCard event="LCP" />
      <RUMMetricCard event="TTFB" />
    </div>
  );
}
