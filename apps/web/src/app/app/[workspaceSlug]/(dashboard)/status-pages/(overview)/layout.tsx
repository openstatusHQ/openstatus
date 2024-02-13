import * as React from "react";
import Link from "next/link";

import { ButtonWithDisableTooltip } from "@openstatus/ui";

import { Header } from "@/components/dashboard/header";
import AppPageLayout from "@/components/layout/app-page-layout";
import { api } from "@/trpc/server";

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isLimitReached = await api.page.isPageLimitReached.query();

  return (
    <AppPageLayout withHelpCallout>
      <Header
        title="Pages"
        description="Overview of all your pages."
        actions={
          <ButtonWithDisableTooltip
            tooltip="You reached the limits"
            asChild={!isLimitReached}
            disabled={isLimitReached}
          >
            <Link href="./status-pages/new">Create</Link>
          </ButtonWithDisableTooltip>
        }
      />
      {children}
    </AppPageLayout>
  );
}
