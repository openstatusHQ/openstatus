import Link from "next/link";

import { Button } from "@openstatus/ui";

import { EmptyState as DefaultEmptyState } from "@/components/dashboard/empty-state";

export function EmptyState({ id }: { id: string }) {
  return (
    <DefaultEmptyState
      icon="megaphone"
      title="No status report updates"
      description="Create your first update"
      action={
        <Button asChild>
          <Link href={`./${id}/update/edit`}>Create</Link>
        </Button>
      }
    />
  );
}
