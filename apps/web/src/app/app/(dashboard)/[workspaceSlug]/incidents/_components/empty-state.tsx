import Link from "next/link";

import { EmptyState as DefaultEmptyState } from "@/components/dashboard/empty-state";
import { Button } from "@/components/ui/button";

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
