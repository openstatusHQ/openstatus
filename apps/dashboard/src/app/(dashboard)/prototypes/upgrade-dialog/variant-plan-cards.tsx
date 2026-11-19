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

import { Link } from "@/components/common/link";
import { cn } from "@/lib/utils";

import {
  addonFor,
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
import { IntervalTabs, Shell } from "./shell";

function Headline({
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
  const label = featureLabel[limit] ?? limit;

  if (typeof value === "number") {
    return (
      <div>
        <p className="flex items-baseline gap-1.5">
          <span className="font-mono text-2xl">{value}</span>
          <span className="text-sm">{unit(limit, value)}</span>
        </p>
        <p className="text-muted-foreground text-xs">
          {addon ? `then ${addon.price}${addon.per}` : "included"}
        </p>
      </div>
    );
  }
  if (value === true) {
    return (
      <div>
        <p className="flex items-center gap-1.5 text-sm font-medium">
          <Check className="size-4" /> {label}
        </p>
        <p className="text-muted-foreground text-xs">included</p>
      </div>
    );
  }
  return (
    <div>
      <p className="text-sm font-medium">{label}</p>
      <p className="text-muted-foreground text-xs">
        {addon ? `add-on, ${addon.price}${addon.per}` : "not included"}
      </p>
    </div>
  );
}

export function VariantPlanCards({ limit, currency, onClose }: VariantProps) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const copy = wallCopy(limit);
  const recommended = recommendedPlan(limit);

  return (
    <Shell onClose={onClose} className="overflow-y-auto sm:max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
          <DialogDescription>{copy.description}</DialogDescription>
        </DialogHeader>
        <IntervalTabs value={interval} onChange={setInterval} />
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        {PAID_PLANS.map((plan) => {
          const isRecommended = plan === recommended;
          const isTrial = plan === "starter" && interval === "monthly";
          return (
            <div
              key={plan}
              className={cn(
                "flex flex-col gap-4 rounded-lg border p-4",
                isRecommended && "border-foreground",
              )}
            >
              <div>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-cal text-lg">{allPlans[plan].title}</p>
                  {isRecommended ? <Badge>Recommended</Badge> : null}
                </div>
                <p>
                  <span className="font-mono text-lg">
                    {planPrice(plan, currency, interval)}
                  </span>
                  <span className="text-muted-foreground text-sm">
                    {interval === "yearly" ? "/year" : "/month"}
                  </span>
                </p>
              </div>
              {limit ? (
                <div className="bg-muted/50 -mx-4 border-y px-4 py-3">
                  <Headline
                    plan={plan}
                    limit={limit}
                    currency={currency}
                    interval={interval}
                  />
                </div>
              ) : null}
              <ul className="text-muted-foreground flex flex-1 flex-col gap-1.5 text-sm">
                {highlights(plan, limit, limit ? 5 : 7).map((item) => (
                  <li key={item.limit} className="flex items-center gap-2">
                    <Check className="text-foreground size-3.5 shrink-0" />
                    {item.text}
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant={isRecommended ? "default" : "outline"}
                onClick={() => fakeCheckout(plan, interval, isTrial)}
              >
                {isTrial
                  ? `Try ${TRIAL_DAYS} days free`
                  : `Choose ${allPlans[plan].title}`}
              </Button>
            </div>
          );
        })}
      </div>
      <p className="text-muted-foreground text-sm">
        Need the full picture?{" "}
        <Link
          href={
            limit
              ? `/settings/billing?highlight=${limit}#plans`
              : "/settings/billing#plans"
          }
        >
          Compare all features <ChevronRight className="inline size-3.5" />
        </Link>
      </p>
    </Shell>
  );
}
