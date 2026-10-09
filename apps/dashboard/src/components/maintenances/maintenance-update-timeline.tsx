"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Maintenance as MaintenanceIcon } from "@openstatus/icons";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

import { ProcessMessage } from "@/components/content/process-message";
import {
  TimelineActor,
  TimelineBody,
  TimelineContent,
  TimelineHeader,
  TimelineIndicator,
  TimelineItem,
  TimelineMeta,
  TimelineTime,
  TimelineTitle,
} from "@/components/content/timeline";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetMaintenanceUpdate } from "@/components/forms/maintenance-update/sheet";
import { distinctEditor } from "@/data/attribution.client";
import { getActions } from "@/data/maintenances.client";
import { useTRPC } from "@/lib/trpc/client";

import { useInvalidateMaintenance } from "./use-invalidate-maintenance";

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;
type MaintenanceUpdate = Maintenance["updates"][number];

export function MaintenanceUpdateTimelineItem({
  maintenance,
  update,
  index,
}: {
  maintenance: Maintenance;
  update: MaintenanceUpdate;
  /** 1-based, counted from the oldest update. */
  index: number;
}) {
  const trpc = useTRPC();
  const [editing, setEditing] = useState(false);
  const invalidate = useInvalidateMaintenance(maintenance.id);
  const edit = useMutation(
    trpc.maintenance.updateUpdate.mutationOptions({ onSuccess: invalidate }),
  );
  const remove = useMutation(
    trpc.maintenance.deleteUpdate.mutationOptions({ onSuccess: invalidate }),
  );
  const author = update.createdByUser;
  const editor = distinctEditor(update);

  return (
    <TimelineItem>
      <TimelineIndicator variant="info">
        <MaintenanceIcon />
      </TimelineIndicator>
      <TimelineContent>
        <TimelineHeader>
          <TimelineTitle>
            <span>Update</span>
            {author ? <TimelineActor actor={author} /> : null}
            {editor ? (
              <TimelineMeta className="inline-flex items-center gap-1.5">
                edited by <TimelineActor actor={editor} />
              </TimelineMeta>
            ) : null}
          </TimelineTitle>
          <TimelineTime date={update.date} />
        </TimelineHeader>
        <TimelineBody className="prose prose-sm dark:prose-invert max-w-none">
          <ProcessMessage value={update.message} />
        </TimelineBody>
        <div className="text-muted-foreground flex items-center justify-between gap-2 font-mono text-xs">
          <span>#{index}</span>
          <QuickActions
            actions={getActions({ edit: () => setEditing(true) })}
            deleteAction={{
              description: `Permanently remove update #${index} from the status page.`,
              submitAction: async () => {
                await remove.mutateAsync({ id: update.id });
              },
            }}
          />
        </div>
      </TimelineContent>
      <FormSheetMaintenanceUpdate
        open={editing}
        onOpenChange={setEditing}
        defaultValues={{ message: update.message, date: update.date }}
        onSubmit={async (values) => {
          await edit.mutateAsync({
            id: update.id,
            message: values.message,
            date: values.date,
          });
        }}
      />
    </TimelineItem>
  );
}
