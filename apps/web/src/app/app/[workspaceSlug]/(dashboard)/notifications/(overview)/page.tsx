import * as React from "react";
import Link from "next/link";

import { Button } from "@openstatus/ui";

import { EmptyState } from "@/components/dashboard/empty-state";
import { Limit } from "@/components/dashboard/limit";
import { columns } from "@/components/data-table/notification/columns";
import { DataTable } from "@/components/data-table/notification/data-table";
import { api } from "@/trpc/server";

export default async function NotificationPage() {
  const notifications =
    await api.notification.getNotificationsByWorkspace.query();
  const isLimitReached =
    await api.notification.isNotificationLimitReached.query();

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon="bell"
        title="No notifications"
        description="Create your first notification channel"
        action={
          <Button asChild>
            <Link href="./notifications/new">Create</Link>
          </Button>
        }
      />
    );
  }

  return (
    <>
      <DataTable columns={columns} data={notifications} />
      {isLimitReached ? <Limit /> : null}
    </>
  );
}
