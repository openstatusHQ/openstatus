import Link from "next/link";

import { Button } from "@openstatus/ui";

import { EmptyState as DefaultEmptyState } from "@/components/dashboard/empty-state";

export function EmptyState() {
  return (
    <DefaultEmptyState
      icon="bell"
      title="No notifications"
      description="Create your first notification channel"
      action={
        <Button asChild>
          <Link href="./notifications/edit">Create</Link>
        </Button>
      }
    />
  );
}
