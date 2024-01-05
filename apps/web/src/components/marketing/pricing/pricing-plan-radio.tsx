"use client";

import { useRouter } from "next/navigation";

import { allPlans, plans } from "@openstatus/plans";
import { Label, RadioGroup, RadioGroupItem } from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { cn } from "@/lib/utils";

export function PricingPlanRadio() {
  const updateSearchParams = useUpdateSearchParams();
  const router = useRouter();
  return (
    <RadioGroup
      defaultValue="team"
      className="grid grid-cols-4 gap-4"
      onValueChange={(value) => {
        const searchParams = updateSearchParams({ plan: value });
        router.replace(`?${searchParams}`, { scroll: false });
      }}
    >
      {plans.map((key) => (
        <div key={key}>
          <RadioGroupItem value={key} id={key} className="peer sr-only" />
          <Label
            htmlFor={key}
            className={cn(
              "border-muted bg-popover hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary flex flex-col items-center justify-between rounded-md border-2 p-4",
              key === "team" && "bg-muted/50",
            )}
          >
            <span className="capitalize">{key}</span>
            <span className="text-muted-foreground mt-1 font-light">
              {allPlans[key].price}€/month
            </span>
          </Label>
        </div>
      ))}
    </RadioGroup>
  );
}
