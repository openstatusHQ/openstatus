import { EmptyState as DefaultEmptyState } from "@/components/dashboard/empty-state";
import { CreateForm } from "./create-form";

export function EmptyState({ workspaceId }: { workspaceId: string }) {
  return (
    <DefaultEmptyState
      icon="activity"
      title="No monitors"
      description="Create your first monitor"
      action={<CreateForm {...{ workspaceId }} />}
    />
  );
}
