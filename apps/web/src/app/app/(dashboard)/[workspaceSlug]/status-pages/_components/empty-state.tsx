import Link from "next/link";
import type * as z from "zod";

import type { allMonitorsSchema } from "@openstatus/db/src/schema";

import { EmptyState as DefaultEmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";

export function EmptyState({
  allMonitors,
}: {
  allMonitors?: z.infer<typeof allMonitorsSchema>;
}) {
  // Navigate user to monitor if they don't have one
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
