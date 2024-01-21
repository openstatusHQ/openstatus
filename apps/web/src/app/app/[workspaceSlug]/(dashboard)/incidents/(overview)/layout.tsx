import * as React from "react";
import Link from "next/link";

import { ButtonWithDisableTooltip } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import { HelpCallout } from "@/components/dashboard/help-callout";
import { api } from "@/trpc/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isLimitReached = await api.monitor.isMonitorLimitReached.query();

  return (
    <div className="grid min-h-full grid-cols-1 grid-rows-[auto,1fr,auto] gap-6 md:grid-cols-2 md:gap-8">
      <Header
        title="Monitors"
        description="Overview of all your monitors."
        actions={
          <ButtonWithDisableTooltip
            tooltip="You reached the limits"
            asChild={!isLimitReached}
            disabled={isLimitReached}
          >
            <Link href="./monitors/new">Create</Link>
          </ButtonWithDisableTooltip>
        }
      />
      <div className="col-span-full">{children}</div>
      <div className="mt-8 md:mt-12">
        <HelpCallout />
      </div>
    </div>
  );
}
