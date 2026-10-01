"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { formatDistanceStrict } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { Link } from "@/components/common/link";
import { StatusDot } from "@/components/common/status-dot";
import {
  Property,
  PropertyInput,
  PropertyLabel,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";
import {
  maintenanceStatusVariants,
  toUpdateInput,
} from "@/data/maintenances.client";
import {
  type MaintenanceStatus,
  maintenanceStatusConfig,
} from "@/data/overview-events.client";
import { formatDateForInput } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { useInvalidateMaintenance } from "./use-invalidate-maintenance";

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;

export function MaintenanceProperties({
  maintenance,
  page,
  status,
}: {
  maintenance: Maintenance;
  page: { id: number; title: string };
  status: MaintenanceStatus;
}) {
  const trpc = useTRPC();
  const invalidate = useInvalidateMaintenance(maintenance.id);
  const [from, setFrom] = useState(formatDateForInput(maintenance.from));
  const [to, setTo] = useState(formatDateForInput(maintenance.to));
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const update = useMutation(
    trpc.maintenance.update.mutationOptions({
      onSuccess: () => {
        toast.success("Schedule saved");
        return invalidate();
      },
      onError: (error) => {
        toast.error(
          isTRPCClientError(error) ? error.message : "Failed to save",
        );
      },
    }),
  );

  const dirty =
    from !== formatDateForInput(maintenance.from) ||
    to !== formatDateForInput(maintenance.to);
  const invalid = !from || !to || new Date(to) <= new Date(from);
  const reset = () => {
    setFrom(formatDateForInput(maintenance.from));
    setTo(formatDateForInput(maintenance.to));
  };

  return (
    <PropertyList>
      <Property>
        <PropertyLabel>Status</PropertyLabel>
        <PropertyValue>
          <StatusDot variant={maintenanceStatusVariants[status]} />
          {maintenanceStatusConfig[status].label}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Status page</PropertyLabel>
        <PropertyValue>
          <Link
            href={`/status-pages/${page.id}/maintenances`}
            className="truncate font-normal"
          >
            {page.title}
          </Link>
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>From</PropertyLabel>
        <PropertyValue>
          <PropertyInput
            type="datetime-local"
            aria-label="From"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
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
            onChange={(e) => setTo(e.target.value)}
          />
          {dirty ? (
            <div className="flex w-full items-center gap-1 font-sans">
              <Button
                size="sm"
                className="h-7"
                disabled={invalid || update.isPending}
                onClick={() =>
                  update.mutate({
                    ...toUpdateInput(maintenance),
                    startDate: new Date(from),
                    endDate: new Date(to),
                  })
                }
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                disabled={update.isPending}
                onClick={reset}
              >
                Reset
              </Button>
              {from && to && invalid ? (
                <span className="text-destructive text-xs">
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
