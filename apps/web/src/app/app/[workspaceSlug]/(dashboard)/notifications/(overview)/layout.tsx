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
  const isLimitReached =
    await api.notification.isNotificationLimitReached.query();
  return (
    <AppPageLayout>
      <Header
        title="Notifications"
        description="Overview of all your notification channels."
        actions={
          <ButtonWithDisableTooltip
            tooltip="You reached the limits"
            asChild={!isLimitReached}
            disabled={isLimitReached}
          >
            <Link href="./notifications/new">Create</Link>
          </ButtonWithDisableTooltip>
        }
      />
      {children}
    </AppPageLayout>
  );
}
