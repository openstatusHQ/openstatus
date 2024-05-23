import Link from "next/link";
import { notFound } from "next/navigation";
import * as React from "react";

import { webVitalEvents } from "@openstatus/rum";
import { Button } from "@openstatus/ui";

import { EmptyState } from "@/components/dashboard/empty-state";
import { api } from "@/trpc/server";
import { RouteTable } from "./_components/route-table";
import { RUMMetricCard } from "./_components/rum-metric-card";

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
    <>
      <div className="grid grid-cols-1 gap-2 lg:grid-cols-5 md:grid-cols-2">
        {webVitalEvents
          //  Remove FID from the list of events because it's deprecated by google
          .filter((v) => v !== "FID")
          .map((event) => (
            <RUMMetricCard key={event} event={event} />
          ))}
      </div>
      <div>
        <RouteTable />
      </div>
    </>
  );
}
