"use client";

import { TRIAL_DAYS } from "@openstatus/api/src/router/stripe/trial-config";
import type { WorkspacePlan } from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { BillingInterval } from "@openstatus/db/src/schema/plan/schema";
import { Check, ChevronRight } from "@openstatus/icons";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@openstatus/ui/components/ui/dialog";
import { useState } from "react";

import { config as featureGroups } from "@/data/plans";
import { cn } from "@/lib/utils";

import {
  addonFor,
  CURRENT_PLAN,
  fakeCheckout,
  groupOf,
  type LimitKey,
  limitValue,
  PAID_PLANS,
  planPrice,
  recommendedPlan,
  type VariantProps,
  wallCopy,
} from "./shared";
import { IntervalTabs, Shell } from "./shell";

const COLUMNS: WorkspacePlan[] = [CURRENT_PLAN, ...PAID_PLANS];

function Cell({
  plan,
  limit,
  currency,
  interval,
}: {
  plan: WorkspacePlan;
  limit: LimitKey;
  currency: string;
  interval: BillingInterval;
}) {
  const value = limitValue(plan, limit);
  const addon = addonFor(plan, limit, currency, interval);

  if (value === false && !addon) {
    return <span className="text-muted-foreground/50">&#8208;</span>;
  }
  if (value === true) return <Check className="size-4" />;
  return (
    <span>
      {typeof value === "boolean" ? null : value}
      {addon ? (
        <span className="text-muted-foreground">
          {typeof value === "boolean" ? "" : " + "}
          {addon.price}
          {addon.per}
        </span>
      ) : null}
    </span>
  );
}

export function VariantPinnedRow({ limit, currency, onClose }: VariantProps) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [open, setOpen] = useState<Record<string, boolean>>(() => {
    const group = limit ? groupOf(limit) : "monitor";
    return group ? { [group]: true } : {};
  });
  const copy = wallCopy(limit);
  const recommended = recommendedPlan(limit);
  const pinned = limit
    ? Object.values(featureGroups)
        .flatMap(({ features }) => features)
        .find((feature) => feature.value === limit)
    : null;

  return (
    <Shell
      onClose={onClose}
      className="flex flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl"
    >
      <div className="flex flex-wrap items-end justify-between gap-4 p-6 pb-4">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <IntervalTabs value={interval} onChange={setInterval} />
      </div>
      <div className="min-h-0 flex-1 overflow-auto border-t">
        <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0 text-sm">
          <thead className="bg-background sticky top-0 z-10">
            <tr>
              <th className="w-[26%] border-b px-6 py-3 text-left align-bottom font-medium">
                Compare plans
              </th>
              {COLUMNS.map((plan) => {
                const isCurrent = plan === CURRENT_PLAN;
                const isTrial = plan === "starter" && interval === "monthly";
                return (
                  <th
                    key={plan}
                    className={cn(
                      "border-b px-3 py-3 text-left align-bottom font-normal",
                      plan === recommended && "bg-muted/50",
                    )}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-cal text-base">
                        {allPlans[plan].title}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {isCurrent
                          ? "Free"
                          : `${planPrice(plan, currency, interval)}/${interval === "yearly" ? "yr" : "mo"}`}
                      </span>
                    </div>
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      variant={plan === recommended ? "default" : "outline"}
                      disabled={isCurrent}
                      onClick={() => fakeCheckout(plan, interval, isTrial)}
                    >
                      {isCurrent
                        ? "Current plan"
                        : isTrial
                          ? `Try ${TRIAL_DAYS} days free`
                          : "Choose"}
                    </Button>
                  </th>
                );
              })}
            </tr>
            {pinned ? (
              <tr className="bg-info/10">
                <th className="border-info/30 border-b px-6 py-2.5 text-left font-medium">
                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 whitespace-nowrap">
                    {pinned.label}
                    <Badge variant="outline" className="border-info/40">
                      {typeof limitValue(CURRENT_PLAN, pinned.value) ===
                      "number"
                        ? "Limit reached"
                        : "Not on Hobby"}
                    </Badge>
                  </span>
                </th>
                {COLUMNS.map((plan) => (
                  <td
                    key={plan}
                    className={cn(
                      "border-info/30 border-b px-3 py-2.5 font-mono",
                      plan === CURRENT_PLAN && "text-muted-foreground",
                    )}
                  >
                    <Cell
                      plan={plan}
                      limit={pinned.value}
                      currency={currency}
                      interval={interval}
                    />
                  </td>
                ))}
              </tr>
            ) : null}
          </thead>
          <tbody>
            {Object.entries(featureGroups).map(([key, group]) => {
              const features = group.features.filter(
                (feature) => feature.value !== limit,
              );
              const isOpen = open[key] ?? false;
              return (
                <GroupRows
                  key={key}
                  label={group.label}
                  count={features.length}
                  isOpen={isOpen}
                  onToggle={() =>
                    setOpen((prev) => ({ ...prev, [key]: !isOpen }))
                  }
                >
                  {features.map((feature) => (
                    <tr key={feature.value} className="hover:bg-muted/40">
                      <td className="border-b px-6 py-2">{feature.label}</td>
                      {COLUMNS.map((plan) => (
                        <td
                          key={plan}
                          className={cn(
                            "border-b px-3 py-2 font-mono",
                            plan === CURRENT_PLAN && "text-muted-foreground",
                            plan === recommended && "bg-muted/50",
                          )}
                        >
                          <Cell
                            plan={plan}
                            limit={feature.value}
                            currency={currency}
                            interval={interval}
                          />
                          {feature.monthly ? "/mo" : ""}
                        </td>
                      ))}
                    </tr>
                  ))}
                </GroupRows>
              );
            })}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}

function GroupRows({
  label,
  count,
  isOpen,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <tr>
        <td colSpan={COLUMNS.length + 1} className="border-b p-0">
          <button
            type="button"
            aria-expanded={isOpen}
            onClick={onToggle}
            className="group bg-muted/30 hover:bg-muted/60 flex w-full items-center gap-2 px-6 py-2 text-left font-medium transition-colors duration-150 ease-out"
          >
            <ChevronRight className="text-muted-foreground size-3.5 transition-transform duration-150 ease-out group-aria-expanded:rotate-90" />
            {label}
            <span className="text-muted-foreground font-mono text-xs font-normal">
              {count}
            </span>
          </button>
        </td>
      </tr>
      {isOpen ? children : null}
    </>
  );
}
