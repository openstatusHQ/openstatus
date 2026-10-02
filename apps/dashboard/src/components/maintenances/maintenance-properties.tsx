"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { formatDistanceStrict } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { StatusDot } from "@/components/common/status-dot";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  Property,
  PropertyDateTimePicker,
  PropertyLabel,
  PropertyLink,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";
import { distinctEditor } from "@/data/attribution.client";
import {
  type MaintenanceStatus,
  maintenanceStatusConfig,
} from "@/data/overview-events.client";
import { useHydrated } from "@/hooks/use-hydrated";

import { useUpdateMaintenance } from "./use-update-maintenance";

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;

function UserProperty({
  label,
  user,
}: {
  label: string;
  user: { name: string; photoUrl: string | null };
}) {
  return (
    <Property>
      <PropertyLabel>{label}</PropertyLabel>
      <PropertyValue>
        <UserAvatar name={user.name} src={user.photoUrl} />
        <span className="truncate">{user.name}</span>
      </PropertyValue>
    </Property>
  );
}

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
  // the formatted dates and the timezone are browser-local
  const hydrated = useHydrated();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // null = pristine: the pickers follow the server copy until edited.
  const [draft, setDraft] = useState<{ from: Date; to: Date } | null>(null);
  const from = draft?.from ?? maintenance.from;
  const to = draft?.to ?? maintenance.to;
  const { update, isPending } = useUpdateMaintenance(maintenance.id, {
    onSuccess: () => {
      toast.success("Schedule saved");
      setDraft(null);
    },
  });

  const dirty =
    draft !== null &&
    (from.getTime() !== maintenance.from.getTime() ||
      to.getTime() !== maintenance.to.getTime());
  const invalid = to <= from;
  const author = maintenance.createdByUser;
  const editor = distinctEditor(maintenance);

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
          {hydrated ? (
            <PropertyDateTimePicker
              aria-label="From"
              value={from}
              onChange={(date) => setDraft({ from: date, to })}
            />
          ) : null}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>To</PropertyLabel>
        <PropertyValue className="flex-wrap">
          {hydrated ? (
            <PropertyDateTimePicker
              aria-label="To"
              value={to}
              onChange={(date) => setDraft({ from, to: date })}
            />
          ) : null}
          {dirty ? (
            <div className="grid w-full grid-cols-2 gap-1 font-sans">
              <Button
                size="sm"
                className="h-7"
                disabled={invalid || isPending}
                onClick={() => update({ startDate: from, endDate: to })}
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
              {invalid ? (
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
      {author ? <UserProperty label="Created by" user={author} /> : null}
      {editor ? <UserProperty label="Edited by" user={editor} /> : null}
      <Property>
        <PropertyLabel>Timezone</PropertyLabel>
        <PropertyValue>
          <span className="truncate">{hydrated ? timezone : null}</span>
        </PropertyValue>
      </Property>
    </PropertyList>
  );
}
