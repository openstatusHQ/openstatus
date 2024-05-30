import Link from "next/link";
import { notFound } from "next/navigation";
import * as React from "react";

import { webVitalEvents } from "@openstatus/rum";
import { Button } from "@openstatus/ui";

import { EmptyState } from "@/components/dashboard/empty-state";
import { api } from "@/trpc/server";
import { RouteTable } from "./_components/route-table";
import { RUMMetricCards } from "./_components/rum-metric-card";
import { Redis } from "@upstash/redis";
import { auth } from "@/lib/auth";
import { RequestButton } from "./_components/request-button/request-button";

export const dynamic = "force-dynamic";

const redis = Redis.fromEnv();

export default async function RUMPage() {
  const applications = await api.workspace.getApplicationWorkspaces.query();

  const session = await auth();
  if (!session?.user) return null;

  const accessRequested = await redis.sismember(
    "rum_access_requested",
    session.user.email
  );

  if (applications.length === 0) {
    return (
      <EmptyState
        icon="ratio"
        title="Real User Monitoring"
        description="The feature is currently in beta and will be released soon."
        action={<RequestButton hasRequestAccess={accessRequested} />}
      />
    );
  }
  //  ATM We can only have access to one application
  return (
    <>
      <RUMMetricCards dsn={applications[0].dsn || ""} />
      {/* {webVitalEvents
          //  Remove FID from the list of events because it's deprecated by google
          .filter((v) => v !== "FID")
          .map((event) => (
            <RUMMetricCard key={event} event={event} />
          ))} */}
      <div>
        <RouteTable dsn={applications[0].dsn || ""} />
      </div>
    </>
  );
}
