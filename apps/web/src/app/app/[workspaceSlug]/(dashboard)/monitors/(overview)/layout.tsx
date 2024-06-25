import { ButtonWithDisableTooltip } from "@openstatus/ui";
import Link from "next/link";
import type { ReactNode } from "react";

import { Header } from "@/components/dashboard/header";
import AppPageLayout from "@/components/layout/app-page-layout";
import { api } from "@/trpc/server";

export const revalidate = 0; // revalidate the data at most every hour
export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";

export default async function Layout({ children }: { children: ReactNode }) {
  const isLimitReached = await api.monitor.isMonitorLimitReached.query();

  return (
    <AppPageLayout>
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
      {children}
    </AppPageLayout>
  );
}
