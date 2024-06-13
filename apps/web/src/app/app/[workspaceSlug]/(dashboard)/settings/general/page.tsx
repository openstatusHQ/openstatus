import { Separator } from "@openstatus/ui";

import { WorkspaceForm } from "@/components/forms/workspace-form";
import { api } from "@/trpc/server";
import { CopyToClipboardButton } from "./_components/copy-to-clipboard-button";

export default async function GeneralPage() {
  const data = await api.workspace.getWorkspace.query();

  return (
    <div className="flex flex-col gap-8">
      <WorkspaceForm defaultValues={{ name: data.name ?? "" }} />
      <Separator />
      <div className="flex flex-col gap-2">
        <p>Workspace Slug</p>
        <p className="text-muted-foreground text-sm">
          The unique identifier for your workspace.
        </p>
        <div>
          <CopyToClipboardButton variant="outline" size="sm">
            {data.slug}
          </CopyToClipboardButton>
        </div>
      </div>
    </div>
  );
}
