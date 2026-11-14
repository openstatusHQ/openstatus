"use client";

import {
  monitorSlaIneligibleReason,
  monitorSlaTargetPresets,
} from "@openstatus/db/src/schema/monitor_sla_policies/constants";
import { Button } from "@openstatus/ui/components/ui/button";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import {
  FormControl,
  FormDescription,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText,
} from "@openstatus/ui/components/ui/input-group";
import { Label } from "@openstatus/ui/components/ui/label";
import { Switch } from "@openstatus/ui/components/ui/switch";
import { cn } from "@openstatus/ui/lib/utils";

import { TimeZoneCombobox } from "@/components/common/time-zone-combobox";
import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  allowedDowntime,
  formatSlaTarget,
  parseSlaTarget,
} from "@/data/reportings.client";

export type MonitorOption = {
  id: number;
  name: string;
  url: string;
  jobType: string;
  regions: readonly string[];
  degradedAfter?: number | null;
};

export const slaTargetSchemaError =
  "Enter a percentage above 0, up to 100, with at most 3 decimals.";

export function SlaTargetField({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  const target = parseSlaTarget(value);
  return (
    <FormItem className={className}>
      <FormLabel>Monthly uptime target</FormLabel>
      <FormControl>
        <InputGroup>
          <InputGroupInput
            inputMode="decimal"
            className="font-mono"
            value={value}
            onChange={(e) => onChange(e.target.value)}
          />
          <InputGroupAddon align="inline-end">
            <InputGroupText>%</InputGroupText>
          </InputGroupAddon>
        </InputGroup>
      </FormControl>
      <div className="flex flex-wrap gap-1.5">
        {monitorSlaTargetPresets.map((preset) => (
          <Button
            key={preset}
            type="button"
            size="sm"
            variant="outline"
            aria-pressed={target === preset}
            className="aria-pressed:bg-muted font-mono"
            onClick={() => onChange(formatSlaTarget(preset))}
          >
            {formatSlaTarget(preset)}
          </Button>
        ))}
      </div>
      {target !== null ? (
        <FormDescription>
          Allows{" "}
          <span className="text-foreground font-mono">
            {allowedDowntime(target)}
          </span>{" "}
          of downtime in a 30-day month.
        </FormDescription>
      ) : null}
      <FormMessage />
    </FormItem>
  );
}

export function SlaStrictField({
  value,
  onChange,
}: {
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <FormItem className="flex flex-row items-start justify-between gap-4">
      <div className="space-y-0.5">
        <FormLabel>Count slow responses as downtime</FormLabel>
        <FormDescription>
          {value
            ? "A check slower than its monitor's degraded threshold counts as down."
            : "A slow check counts as up, as on the status page."}
        </FormDescription>
      </div>
      <FormControl>
        <Switch checked={value} onCheckedChange={onChange} />
      </FormControl>
    </FormItem>
  );
}

export function SlaTimeZoneField({
  value,
  onChange,
  locked,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  /** a month is sealed: its edges are fixed in this zone */
  locked?: boolean;
  className?: string;
}) {
  return (
    <FormItem className={className}>
      <FormLabel>Time zone</FormLabel>
      <FormControl>
        <TimeZoneCombobox value={value} onChange={onChange} disabled={locked} />
      </FormControl>
      <FormDescription>
        {locked
          ? "Locked: a month has been sealed in this zone, and sealed months keep their edges."
          : "Months run from midnight on the 1st in this zone. It locks once a month is sealed."}
      </FormDescription>
      <FormMessage />
    </FormItem>
  );
}

export function SlaMonitorsField({
  monitors,
  value,
  onChange,
  strict,
  className,
}: {
  monitors: MonitorOption[];
  value: number[];
  onChange: (value: number[]) => void;
  strict: boolean;
  className?: string;
}) {
  if (!monitors.length) {
    return (
      <EmptyStateContainer>
        <EmptyStateTitle>No monitors found</EmptyStateTitle>
      </EmptyStateContainer>
    );
  }
  return (
    <div className={cn("grid gap-2", className)}>
      {monitors.map((monitor) => {
        const reason = monitorSlaIneligibleReason(monitor);
        const checked = value.includes(monitor.id);
        const neverSlow = strict && !reason && monitor.degradedAfter == null;
        const id = `sla-monitor-${monitor.id}`;
        return (
          <Label
            key={monitor.id}
            htmlFor={id}
            className="hover:bg-muted/50 has-aria-checked:bg-muted/50 flex min-w-0 items-start gap-3 rounded-lg border p-3 font-normal has-disabled:opacity-60 has-disabled:hover:bg-transparent"
          >
            <Checkbox
              id={id}
              // a member that became ineligible can still be removed
              disabled={reason !== null && !checked}
              checked={checked}
              onCheckedChange={(next) =>
                onChange(
                  next === true
                    ? [...value, monitor.id]
                    : value.filter((v) => v !== monitor.id),
                )
              }
            />
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-medium">{monitor.name}</span>
              {reason ? (
                <span className="text-muted-foreground text-xs">
                  Not eligible: {reason}.
                </span>
              ) : (
                <span className="text-muted-foreground truncate font-mono text-xs">
                  {monitor.url}
                </span>
              )}
              {neverSlow ? (
                <span className="text-warning text-xs">
                  No degraded threshold: its checks are never slow, so they
                  always count as up.
                </span>
              ) : null}
            </span>
          </Label>
        );
      })}
    </div>
  );
}
