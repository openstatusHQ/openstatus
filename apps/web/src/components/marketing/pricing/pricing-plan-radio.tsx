"use client";

import { allPlans } from "@openstatus/db/src/schema/plan/config";
import { workspacePlans } from "@openstatus/db/src/schema/workspaces/constants";
import { Label } from "@openstatus/ui/src/components/label";
import {
  RadioGroup,
  RadioGroupItem,
} from "@openstatus/ui/src/components/radio-group";

import { useCookieState } from "@/hooks/use-cookie-state";
import { cn } from "@/lib/utils";
import type { WorkspacePlan } from "@openstatus/db/src/schema";
import { getPriceConfig } from "@openstatus/db/src/schema/plan/utils";

export function PricingPlanRadio({
  onChange,
}: {
  onChange(value: WorkspacePlan): void;
}) {
  const [currency] = useCookieState("x-currency", "USD");
  return (
    <RadioGroup
      defaultValue="team"
      className="grid grid-cols-3 gap-4"
      onValueChange={onChange}
    >
      {workspacePlans.map((key) => {
        const price = getPriceConfig(key, currency);
        return (
          <div key={key}>
            <RadioGroupItem value={key} id={key} className="peer sr-only" />
            <Label
              htmlFor={key}
              className={cn(
                "flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary",
                key === "team" && "bg-muted/50",
              )}
            >
              <span className="text-sm capitalize">{allPlans[key].title}</span>
              <span className="mt-1 font-light text-muted-foreground text-xs">
                {new Intl.NumberFormat(price.locale, {
                  style: "currency",
                  currency: price.currency,
                }).format(price.value)}
                /month
              </span>
            </Label>
          </div>
        );
      })}
    </RadioGroup>
  );
}
