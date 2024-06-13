import { ButtonWithDisableTooltip } from "@openstatus/ui";
import Link from "next/link";
import type { ReactNode } from "react";

import { Header } from "@/components/dashboard/header";
import AppPageLayout from "@/components/layout/app-page-layout";
import { api } from "@/trpc/server";

export default async function Layout({ children }: { children: ReactNode }) {
  const isLimitReached = await api.page.isPageLimitReached.query();

  return (
    <AppPageLayout>
      <Header
        title="Status Pages"
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
