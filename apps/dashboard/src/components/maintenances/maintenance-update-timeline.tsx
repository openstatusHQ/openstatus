"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Maintenance as MaintenanceIcon } from "@openstatus/icons";
import { useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";

import { ProcessMessage } from "@/components/content/process-message";
import {
  TimelineActions,
  TimelineActor,
  TimelineBody,
  TimelineCard,
  TimelineHeader,
  TimelineHighlight,
  TimelineIndicator,
  TimelineItem,
  TimelineTime,
} from "@/components/content/timeline";
import { QuickActions } from "@/components/dropdowns/quick-actions";
import { FormSheetMaintenanceUpdate } from "@/components/forms/maintenance-update/sheet";
import { distinctEditor } from "@/data/attribution.client";
import { getActions } from "@/data/maintenances.client";
import { useHydrated } from "@/hooks/use-hydrated";
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
      <TimelineCard>
        <TimelineHeader>
          {author ? (
            <>
              <TimelineActor actor={author} avatar /> posted
            </>
          ) : (
            "Posted"
          )}
          <TimelineTime date={update.date} />
          {editor ? (
            <>
              · edited by <TimelineActor actor={editor} />
            </>
          ) : null}
          <TimelineActions>
            <span>#{index}</span>
            <QuickActions
              actions={getActions({ edit: () => setEditing(true) })}
              deleteAction={
                // a maintenance keeps at least one update; delete it instead
                maintenance.updates.length > 1
                  ? {
                      description: `Permanently remove update #${index} from the status page.`,
                      submitAction: async () => {
                        await remove.mutateAsync({ id: update.id });
                      },
                    }
                  : undefined
              }
            />
          </TimelineActions>
        </TimelineHeader>
        <TimelineBody>
          <ProcessMessage value={update.message} />
        </TimelineBody>
      </TimelineCard>
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

/** Closing row: who scheduled the window, and when it runs. */
export function MaintenanceScheduledTimelineItem({
  maintenance,
}: {
  maintenance: Maintenance;
}) {
  // local-time text differs between server and browser
  const hydrated = useHydrated();
  return (
    <TimelineItem>
      <TimelineIndicator>
        <MaintenanceIcon />
      </TimelineIndicator>
      <TimelineHeader>
        {maintenance.createdByUser ? (
          <>
            <TimelineActor actor={maintenance.createdByUser} /> scheduled the
            maintenance for
          </>
        ) : (
          "Maintenance scheduled for"
        )}
        <TimelineHighlight>
          {hydrated
            ? `${format(maintenance.from, "LLL dd, HH:mm")} – ${format(maintenance.to, "LLL dd, HH:mm")}`
            : null}
        </TimelineHighlight>
        {maintenance.createdAt ? (
          <TimelineTime date={maintenance.createdAt} />
        ) : null}
      </TimelineHeader>
    </TimelineItem>
  );
}
