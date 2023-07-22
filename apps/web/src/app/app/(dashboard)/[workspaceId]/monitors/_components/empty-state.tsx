import { Icons } from "@/components/icons";
import { CreateForm } from "./create-form";

export function EmptyState({ workspaceId }: { workspaceId: number }) {
  return (
    <div className="border-border bg-background col-span-full w-full rounded-lg border border-dashed p-8">
      <div className="flex flex-col items-center justify-center gap-4">
        <div className="flex flex-col items-center justify-center gap-1">
          <Icons.activity className="h-6 w-6" />
          <p className="text-foreground text-base">No monitors</p>
          <p className="text-muted-foreground">Create your first monitor.</p>
        </div>
        <CreateForm {...{ workspaceId }} />
      </div>
    </div>
  );
}
