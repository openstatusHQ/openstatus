import Link from "next/link";

import type { Monitor } from "@openstatus/db/src/schema";
import { Button } from "@openstatus/ui";

import { EmptyState as DefaultEmptyState } from "@/components/dashboard/empty-state";

export function EmptyState({ allMonitors }: { allMonitors?: Monitor[] }) {
  if (!Boolean(allMonitors?.length)) {
    return (
      <DefaultEmptyState
        icon="panel-top"
        title="No pages"
        description="First create a monitor before creating a page."
        action={
          <Button asChild>
            <Link href="./monitors/edit">Create a monitor</Link>
          </Button>
        }
      />
    );
  }
  return (
    <DefaultEmptyState
      icon="panel-top"
      title="No pages"
      description="Create your first page."
      action={
        <Button asChild>
          <Link href="./status-pages/edit">Create</Link>
        </Button>
      }
    />
  );
}
