import Link from "next/link";

import { Button } from "@openstatus/ui/src/components/button";

import { EmptyState as DefaultEmptyState } from "@/components/dashboard/empty-state";

export function EmptyState() {
  return (
    <DefaultEmptyState
      icon="siren"
      title="No incidents"
      description="Create your first incident"
      action={
        <Button asChild>
          <Link href="./incidents/edit">Create</Link>
        </Button>
      }
    />
  );
}
