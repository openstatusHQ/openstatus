"use client";

import { TRIAL_DAYS } from "@openstatus/api/src/router/stripe/trial-config";
import type { WorkspacePlan } from "@openstatus/db/src/schema";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { BillingInterval } from "@openstatus/db/src/schema/plan/schema";
import { Check } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@openstatus/ui/components/ui/dialog";
import { Progress } from "@openstatus/ui/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { useState } from "react";

import { Link } from "@/components/common/link";
import { cn } from "@/lib/utils";

import {
  addonFor,
  CURRENT_PLAN,
  fakeCheckout,
  featureLabel,
  highlights,
  type LimitKey,
  limitValue,
  PAID_PLANS,
  planPrice,
  recommendedPlan,
  unit,
  type VariantProps,
  wallCopy,
} from "./shared";
import { Shell } from "./shell";

function BeforeAfter({
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
  const before = limitValue(CURRENT_PLAN, limit);
  const after = limitValue(plan, limit);
  const addon = addonFor(plan, limit, currency, interval);
  const rows = [
    { plan: CURRENT_PLAN, value: before, muted: true },
    { plan, value: after, muted: false },
  ];

  return (
    <div className="divide-y rounded-lg border">
      {rows.map((row) => (
        <div
          key={row.plan}
          className={cn(
            "flex flex-col gap-2 p-3",
            row.muted && "text-muted-foreground",
          )}
        >
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium">
              {allPlans[row.plan].title}
              {row.muted ? " (current)" : ""}
            </span>
            {typeof row.value === "number" && typeof before === "number" ? (
              <span className="font-mono">
                <span className="text-foreground">{before}</span>/{row.value}{" "}
                {unit(limit, row.value)}
              </span>
            ) : row.value === true ? (
              <span className="text-foreground flex items-center gap-1.5">
                <Check className="size-4" /> Included
              </span>
            ) : addon && !row.muted ? (
              <span className="font-mono">
                add-on, {addon.price}
                {addon.per}
              </span>
            ) : (
              <span>Not included</span>
            )}
          </div>
          {typeof row.value === "number" && typeof before === "number" ? (
            <Progress
              value={(before / row.value) * 100}
              className={cn(
                "*:duration-200 *:ease-out motion-reduce:*:transition-none",
                row.muted && "*:bg-muted-foreground",
              )}
            />
          ) : null}
        </div>
      ))}
    </div>
  );
}

export function VariantOnePlan({ limit, currency, onClose }: VariantProps) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [plan, setPlan] = useState<WorkspacePlan>(() => recommendedPlan(limit));
  const copy = wallCopy(limit);
  const isTrial = plan === "starter" && interval === "monthly";
  const title = allPlans[plan].title;
  const addon = limit ? addonFor(plan, limit, currency, interval) : null;
  const sameAsCurrent =
    limit && limitValue(plan, limit) === limitValue(CURRENT_PLAN, limit);

  return (
    <Shell onClose={onClose} className="overflow-y-auto sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>
          {limit
            ? `${title} is the smallest plan that lifts this limit.`
            : copy.description}
        </DialogDescription>
      </DialogHeader>
      <Tabs
        value={plan}
        onValueChange={(next) => setPlan(next as WorkspacePlan)}
      >
        <TabsList className="w-full">
          {PAID_PLANS.map((id) => (
            <TabsTrigger key={id} value={id} className="flex-1">
              {allPlans[id].title}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>
      {limit ? (
        <BeforeAfter
          plan={plan}
          limit={limit}
          currency={currency}
          interval={interval}
        />
      ) : null}
      {limit && sameAsCurrent && addon ? (
        <p className="text-muted-foreground text-sm">
          {title} keeps the same {(featureLabel[limit] ?? limit).toLowerCase()}.
          Extra ones are {addon.price}
          {addon.per} from the add-ons.
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <p className="text-sm font-medium">
          {limit ? `Also in ${title}` : `What ${title} adds`}
        </p>
        <ul className="text-muted-foreground grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm">
          {highlights(plan, limit, 6).map((item) => (
            <li key={item.limit} className="flex items-center gap-2">
              <Check className="text-foreground size-3.5 shrink-0" />
              {item.text}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <Button onClick={() => fakeCheckout(plan, interval, isTrial)}>
          {isTrial
            ? `Try ${title} free for ${TRIAL_DAYS} days`
            : `Upgrade to ${title}`}
          <span className="font-mono font-normal opacity-70">
            {planPrice(plan, currency, interval)}
            {interval === "yearly" ? "/yr" : "/mo"}
          </span>
        </Button>
        <div className="text-muted-foreground flex items-center justify-between text-sm">
          <button
            type="button"
            className="hover:text-foreground underline-offset-4 transition-colors duration-150 ease-out hover:underline"
            onClick={() =>
              setInterval(interval === "monthly" ? "yearly" : "monthly")
            }
          >
            {interval === "monthly"
              ? "Pay yearly, get 2 months free"
              : "Switch back to monthly"}
          </button>
          <Link
            href={
              limit
                ? `/settings/billing?highlight=${limit}#plans`
                : "/settings/billing#plans"
            }
          >
            Compare all plans
          </Link>
        </div>
      </div>
    </Shell>
  );
}
