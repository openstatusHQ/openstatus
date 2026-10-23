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
import { useQuery } from "@tanstack/react-query";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";

import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { PERIODS, isPaidPeriod } from "@/data/metrics.client";
import { useTRPC } from "@/lib/trpc/client";

// TODO: where to move it?
export const PERIOD_VALUES = [
  {
    value: "1d",
    label: "Last day",
  },
  {
    value: "7d",
    label: "Last 7 days",
  },
  {
    value: "14d",
    label: "Last 14 days",
  },
  {
    value: "30d",
    label: "Last 30 days",
  },
  {
    value: "90d",
    label: "Last 90 days",
  },
] satisfies { value: (typeof PERIODS)[number]; label: string }[];

const parsePeriod = parseAsStringLiteral(PERIODS).withDefault("1d");

export function DropdownPeriod() {
  const [period, setPeriod] = useQueryState("period", parsePeriod);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const isFree = workspace?.plan === "free";

  return (
    <>
      <Select
        value={period}
        onValueChange={(value) => {
          const next = value as (typeof PERIODS)[number];
          if (isFree && isPaidPeriod(next)) setUpgradeOpen(true);
          else setPeriod(next);
        }}
      >
        <SelectTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="decoration-border hover:decoration-foreground data-[state=open]:decoration-foreground h-auto rounded-md px-1 py-0 text-[length:inherit] leading-[inherit] font-medium underline underline-offset-3 hover:bg-transparent dark:hover:bg-transparent"
          >
            <SelectValue />
          </Button>
        </SelectTrigger>
        <SelectContent position="item-aligned">
          <SelectGroup>
            <SelectLabel>Period</SelectLabel>
            {PERIOD_VALUES.map(({ value, label }) => {
              const locked = isFree && isPaidPeriod(value);
              return (
                <SelectItem
                  key={value}
                  value={value}
                  data-locked={locked}
                  className="data-[locked=true]:opacity-70"
                >
                  {label}
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
        limit="data-retention"
      />
    </>
  );
}
