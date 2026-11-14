"use client";

import { MONITOR_SLA_EXPORT_MAX_MONTHS } from "@openstatus/db/src/schema/monitor_sla_policies/constants";
import { Download } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import { Label } from "@openstatus/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { formatSlaMonth } from "@/data/reportings.client";
import { useTRPC } from "@/lib/trpc/client";

/** YYYY-MM for the UTC month `offset` months from now. */
function utcMonth(offset: number): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
    .toISOString()
    .slice(0, 7);
}

export function MonitorSlaExportPopover({ policyId }: { policyId: number }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  // newest first: the current month, then the complete months before it
  const options = useMemo(
    () =>
      Array.from({ length: MONITOR_SLA_EXPORT_MAX_MONTHS }, (_, i) =>
        utcMonth(-i),
      ),
    [],
  );
  const [from, setFrom] = useState(() => utcMonth(-12));
  const [to, setTo] = useState(() => utcMonth(-1));
  const [includeLive, setIncludeLive] = useState(false);
  const invalid = from > to;

  function download() {
    startTransition(async () => {
      try {
        const res = await queryClient.fetchQuery({
          ...trpc.monitorReporting.export.queryOptions({
            id: policyId,
            from,
            to,
            includeLive,
          }),
          staleTime: 0,
        });
        if (!res) return;
        const url = URL.createObjectURL(
          new Blob([res.csv], { type: "text/csv;charset=utf-8" }),
        );
        const a = document.createElement("a");
        a.href = url;
        a.download = res.filename;
        a.click();
        URL.revokeObjectURL(url);
        setOpen(false);
      } catch (error) {
        toast.error(
          isTRPCClientError(error) ? error.message : "Failed to export",
        );
      }
    });
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline">
          <Download />
          Export
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="flex w-72 flex-col gap-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={`${id}-from`}>From</Label>
            <Select value={from} onValueChange={setFrom}>
              <SelectTrigger id={`${id}-from`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatSlaMonth(`${m}-01`, { year: true })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={`${id}-to`}>To</Label>
            <Select value={to} onValueChange={setTo}>
              <SelectTrigger id={`${id}-to`} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((m) => (
                  <SelectItem key={m} value={m}>
                    {formatSlaMonth(`${m}-01`, { year: true })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${id}-live`}
            checked={includeLive}
            onCheckedChange={(checked) => setIncludeLive(checked === true)}
          />
          <Label htmlFor={`${id}-live`} className="font-normal">
            Include live months, marked provisional
          </Label>
        </div>
        <p className="text-muted-foreground text-xs">
          One row per monitor and month, with the run counts, uptime and whether
          the month is sealed or a preview. The file states the method.
        </p>
        {invalid ? (
          <p className="text-destructive text-xs">
            The first month must not be after the last.
          </p>
        ) : null}
        <Button size="sm" onClick={download} disabled={isPending || invalid}>
          {isPending ? "Exporting..." : "Download CSV"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
