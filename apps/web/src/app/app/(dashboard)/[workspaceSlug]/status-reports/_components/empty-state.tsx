import Link from "next/link";

import { Button } from "@openstatus/ui";

import { EmptyState as DefaultEmptyState } from "@/components/dashboard/empty-state";

export function EmptyState() {
  return (
    <DefaultEmptyState
      icon="siren"
      title="No status reports"
      description="Create your first status report"
      action={
        <Button asChild>
          <Link href="./status-reports/edit">Create</Link>
        </Button>
      }
    />
  );
}
