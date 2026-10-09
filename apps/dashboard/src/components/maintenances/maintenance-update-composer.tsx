"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import { Label } from "@openstatus/ui/components/ui/label";
import { personName } from "@openstatus/utils";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { DateTimePicker } from "@/components/common/date-time-picker";
import {
  Composer,
  ComposerFooter,
  ComposerHeader,
  ComposerPreview,
  ComposerTextarea,
} from "@/components/content/composer";
import { TimelineAvatar, TimelineItem } from "@/components/content/timeline";
import { useTRPC } from "@/lib/trpc/client";
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
  const trpc = useTRPC();
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const [message, setMessage] = useState("");
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
      <TimelineAvatar
        name={user ? personName(user) : null}
        src={user?.photoUrl}
      />
      <Composer>
        <ComposerHeader />
        <ComposerTextarea
          placeholder="What changed? Customers will read this on the status page."
          disabled={publish.isPending}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onSubmit={() => submit().catch(console.error)}
        />
        <ComposerPreview value={message} />
        <ComposerFooter>
          <div className="flex flex-wrap items-center gap-2">
            <span>Posted</span>
            <DateTimePicker
              key={now.getTime()}
              aria-label="Date"
              value={date ?? now}
              onChange={setDate}
              max={new Date()}
              className="bg-background text-foreground h-8 w-fit font-mono"
            />
          </div>
          <div className="ml-auto flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-start">
            <div className="flex items-center gap-2">
              <Checkbox
                id="notify-subscribers"
                checked={notify}
                disabled={!canNotify}
                onCheckedChange={(value) => setNotifyChecked(value === true)}
              />
              <Label
                htmlFor="notify-subscribers"
                className="text-xs font-normal whitespace-nowrap"
                title={
                  canNotify
                    ? undefined
                    : "Subscriber notifications are not included in your plan."
                }
              >
                Notify subscribers
              </Label>
            </div>
            <Button
              size="sm"
              className="ml-auto"
              disabled={disabled}
              onClick={() => submit().catch(console.error)}
            >
              Publish update
            </Button>
          </div>
        </ComposerFooter>
      </Composer>
    </TimelineItem>
  );
}
