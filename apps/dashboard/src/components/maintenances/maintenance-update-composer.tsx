"use client";

import type { RouterOutputs } from "@openstatus/api";
import { cn } from "@openstatus/ui/lib/utils";
import { useState } from "react";
import { toast } from "sonner";

import { DateTimePicker } from "@/components/common/date-time-picker";
import {
  Composer,
  ComposerActions,
  ComposerFooter,
  composerControlClassName,
  ComposerNotifyToggle,
  ComposerPreview,
  ComposerPreviewToggle,
  ComposerSubmit,
  ComposerTextarea,
  useComposerDraft,
} from "@/components/content/composer";
import { TimelineItem } from "@/components/content/timeline";
import { errorMessage } from "@/lib/trpc/error";

import { usePublishMaintenanceUpdate } from "./use-publish-maintenance-update";

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;

/** Posts a dated note on the maintenance timeline; the newest is the public message. */
export function MaintenanceUpdateComposer({
  maintenance,
  canNotify,
}: {
  maintenance: Maintenance;
  /** Whether the plan includes subscriber notifications. */
  canNotify: boolean;
}) {
  const [message, setMessage] = useComposerDraft(
    `maintenance:${maintenance.id}`,
  );
  const [notifyChecked, setNotifyChecked] = useState(true);
  // null = now, resolved at publish time so an open composer never backdates.
  const [date, setDate] = useState<Date | null>(null);
  // shown while `date` is null; refreshed on reset
  const [now, setNow] = useState(() => new Date());

  const publish = usePublishMaintenanceUpdate(maintenance.id);
  const notify = canNotify && notifyChecked;
  const disabled = publish.isPending || !message.trim();

  function reset() {
    setMessage("");
    setDate(null);
    setNow(new Date());
  }

  async function submit() {
    if (disabled) return;
    const promise = publish.publish({
      message: message.trim(),
      date: date ?? new Date(),
      notifySubscribers: notify,
    });
    toast.promise(promise, {
      loading: "Publishing...",
      success: "Update published",
      error: (error) => errorMessage(error, "Failed to publish"),
    });
    await promise;
    reset();
  }

  return (
    <TimelineItem>
      <Composer className="col-span-full">
        <ComposerTextarea
          placeholder="What changed? Customers will read this on the status page."
          value={message}
          disabled={publish.isPending}
          onChange={(e) => setMessage(e.target.value)}
          onSubmit={() => submit().catch(console.error)}
        />
        <ComposerPreview value={message} />
        <ComposerFooter>
          <div className="flex flex-wrap items-center gap-2">
            <span className="pl-2">Posted</span>
            <DateTimePicker
              key={now.getTime()}
              aria-label="Date"
              value={date ?? now}
              onChange={setDate}
              max={new Date()}
              className={cn(composerControlClassName, "h-8 w-fit")}
            />
          </div>
          <ComposerActions>
            <ComposerPreviewToggle />
            <ComposerNotifyToggle
              canNotify={canNotify}
              pressed={notifyChecked}
              onPressedChange={setNotifyChecked}
            />
            <ComposerSubmit
              label="Publish update"
              disabled={disabled}
              onClick={() => submit().catch(console.error)}
            />
          </ComposerActions>
        </ComposerFooter>
      </Composer>
    </TimelineItem>
  );
}
