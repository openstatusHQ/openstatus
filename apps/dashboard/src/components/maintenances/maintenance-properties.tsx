"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { formatDistanceStrict } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { StatusDot } from "@/components/common/status-dot";
import {
  Property,
  PropertyInput,
  PropertyLabel,
  PropertyLink,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";
import {
  type MaintenanceStatus,
  maintenanceStatusConfig,
} from "@/data/overview-events.client";
import { formatDateForInput } from "@/lib/formatter";

import { useUpdateMaintenance } from "./use-update-maintenance";

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;

export function MaintenanceProperties({
  maintenance,
  page,
  status,
  publicUrl,
}: {
  maintenance: Maintenance;
  page: { id: number; title: string };
  status: MaintenanceStatus;
  publicUrl: string;
}) {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // null = pristine: the inputs follow the server copy until edited.
  const [draft, setDraft] = useState<{ from: string; to: string } | null>(null);
  const serverFrom = formatDateForInput(maintenance.from);
  const serverTo = formatDateForInput(maintenance.to);
  const from = draft?.from ?? serverFrom;
  const to = draft?.to ?? serverTo;
  const { update, isPending } = useUpdateMaintenance(maintenance.id, {
    onSuccess: () => {
      toast.success("Schedule saved");
      setDraft(null);
    },
  });

  const dirty = draft !== null && (from !== serverFrom || to !== serverTo);
  const invalid = !from || !to || new Date(to) <= new Date(from);

  return (
    <PropertyList>
      <Property>
        <PropertyLabel>Status</PropertyLabel>
        <PropertyValue>
          <StatusDot variant={maintenanceStatusConfig[status].variant} />
          {maintenanceStatusConfig[status].label}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Status page</PropertyLabel>
        <PropertyValue>
          <PropertyLink href={publicUrl}>{page.title}</PropertyLink>
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>From</PropertyLabel>
        <PropertyValue>
          <PropertyInput
            type="datetime-local"
            aria-label="From"
            value={from}
            onChange={(e) => setDraft({ from: e.target.value, to })}
          />
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>To</PropertyLabel>
        <PropertyValue className="flex-wrap">
          <PropertyInput
            type="datetime-local"
            aria-label="To"
            value={to}
            onChange={(e) => setDraft({ from, to: e.target.value })}
          />
          {dirty ? (
            <div className="grid w-full grid-cols-2 gap-1 font-sans">
              <Button
                size="sm"
                className="h-7"
                disabled={invalid || isPending}
                onClick={() =>
                  update({ startDate: new Date(from), endDate: new Date(to) })
                }
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                disabled={isPending}
                onClick={() => setDraft(null)}
              >
                Reset
              </Button>
              {from && to && invalid ? (
                <span className="text-destructive col-span-full text-xs">
                  End must be after start
                </span>
              ) : null}
            </div>
          ) : null}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Duration</PropertyLabel>
        <PropertyValue>
          {formatDistanceStrict(maintenance.from, maintenance.to)}
          {status === "in-progress" ? (
            <>
              <StatusDot variant="warning" className="size-1.5" />
              <span className="sr-only">in progress</span>
            </>
          ) : null}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Timezone</PropertyLabel>
        <PropertyValue>
          <span className="truncate" suppressHydrationWarning>
            {timezone}
          </span>
        </PropertyValue>
      </Property>
    </PropertyList>
  );
}
