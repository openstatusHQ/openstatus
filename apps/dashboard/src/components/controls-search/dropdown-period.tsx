"use client";

import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { PAID_PERIODS, PERIODS } from "@/data/metrics.client";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import { useQuery } from "@tanstack/react-query";
import { Check, Lock } from "lucide-react";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { useState } from "react";

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

const PAID_PERIOD_SET = new Set<string>(PAID_PERIODS);

const parsePeriod = parseAsStringLiteral(PERIODS).withDefault("1d");

export function DropdownPeriod() {
  const [period, setPeriod] = useQueryState("period", parsePeriod);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const isFree = workspace?.plan === "free";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            {PERIOD_VALUES.find(({ value }) => value === period)?.label}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          <DropdownMenuGroup>
            <DropdownMenuLabel className="font-medium text-muted-foreground text-xs">
              Period
            </DropdownMenuLabel>
            {PERIOD_VALUES.map(({ value, label }) => {
              const locked = isFree && PAID_PERIOD_SET.has(value);
              return (
                <DropdownMenuItem
                  key={value}
                  data-locked={locked}
                  onSelect={() =>
                    locked ? setUpgradeOpen(true) : setPeriod(value)
                  }
                  className={"data-[locked=true]:opacity-70"}
                >
                  {label}
                  {locked ? (
                    <Lock className="ml-auto shrink-0" />
                  ) : period === value ? (
                    <Check className="ml-auto shrink-0" />
                  ) : null}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <UpgradeDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        limit="data-retention"
      />
    </>
  );
}
