import Link from "next/link";
import type * as z from "zod";

import type { insertMonitorSchema } from "@openstatus/db/src/schema";

import { EmptyState as DefaultEmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";
import { CreateForm } from "./create-form";

type MonitorSchema = z.infer<typeof insertMonitorSchema>;

export function EmptyState({
  workspaceId,
  allMonitors,
}: {
  workspaceId: number;
  allMonitors?: MonitorSchema[];
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
            <Link href="./monitors">Go to monitors</Link>
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
      action={<CreateForm {...{ workspaceId, allMonitors }} />}
    />
  );
}
