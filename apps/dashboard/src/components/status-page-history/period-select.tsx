"use client";

import { Lock } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { SelectTrigger } from "@radix-ui/react-select";
import { useState } from "react";

import { UpgradeDialog } from "@/components/dialogs/upgrade";
import {
  defaultHistoryPeriod,
  HISTORY_PERIODS,
  type HistoryPeriod,
} from "@/data/uptime-history.client";

/**
 * How many months the history covers, as an inline sentence trigger like
 * `CalculationSelect`. Periods past the plan's `limit` open the upgrade dialog.
 */
export function PeriodSelect({
  value,
  limit,
  onValueChange,
}: {
  value: number;
  limit: number;
  /** null for the default period, so the search param drops out */
  onValueChange: (value: HistoryPeriod | null) => void;
}) {
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  return (
    <>
      <Select
        value={String(value)}
        onValueChange={(next) => {
          const period = HISTORY_PERIODS.find((p) => String(p) === next);
          if (!period) return;
          if (period > limit) setUpgradeOpen(true);
          else {
            onValueChange(
              period === defaultHistoryPeriod(limit) ? null : period,
            );
          }
        }}
      >
        <SelectTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="decoration-border hover:decoration-foreground data-[state=open]:decoration-foreground h-auto rounded-md px-1 py-0 text-[length:inherit] leading-[inherit] font-medium underline underline-offset-3 hover:bg-transparent dark:hover:bg-transparent"
          >
            <SelectValue>last {value} months</SelectValue>
          </Button>
        </SelectTrigger>
        <SelectContent position="item-aligned">
          <SelectGroup>
            <SelectLabel>Period</SelectLabel>
            {HISTORY_PERIODS.map((period) => {
              const locked = period > limit;
              return (
                <SelectItem
                  key={period}
                  value={String(period)}
                  data-locked={locked}
                  className="data-[locked=true]:opacity-70"
                >
                  Last {period} months
                  {/* children sit inside ItemText, so take the indicator's slot instead of ml-auto */}
                  {locked ? <Lock className="absolute right-2" /> : null}
                </SelectItem>
              );
            })}
          </SelectGroup>
        </SelectContent>
      </Select>
      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        limit="uptime-history"
      />
    </>
  );
}
