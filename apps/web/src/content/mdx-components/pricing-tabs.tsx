"use client";

import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { BillingInterval } from "@openstatus/db/src/schema/plan/schema";
import { getPriceConfig } from "@openstatus/db/src/schema/plan/utils";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback } from "react";

const planColumns = [
  { plan: "free" as const, header: "Hobby" },
  { plan: "starter" as const, header: "Starter" },
  { plan: "team" as const, header: "Pro" },
] as const;

export function PricingTabs() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const interval = (
    searchParams.get("interval") === "yearly" ? "yearly" : "monthly"
  ) as BillingInterval;

  const setInterval = useCallback(
    (value: string) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === "monthly") {
        params.delete("interval");
      } else {
        params.set("interval", value);
      }
      const qs = params.toString();
      router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
    },
    [searchParams, router, pathname],
  );

  return (
    <div className="not-prose mb-4">
      <Tabs value={interval} onValueChange={setInterval}>
        <TabsList className="h-auto w-full rounded-none">
          <TabsTrigger
            value="monthly"
            className="h-auto w-full truncate rounded-none p-3.5"
          >
            Monthly
          </TabsTrigger>
          <TabsTrigger
            value="yearly"
            className="h-auto w-full truncate rounded-none p-3.5"
          >
            Yearly{" "}
            <Badge variant="secondary" className="ml-1.5 h-auto rounded-none">
              2 months free
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      <PricingUpdater interval={interval} />
    </div>
  );
}

function PricingUpdater({ interval }: { interval: BillingInterval }) {
  const formatPrice = useCallback(
    (plan: (typeof planColumns)[number]["plan"]) => {
      const config = allPlans[plan];
      if (plan === "free") return "Free - Hobby";
      const price = getPriceConfig(plan, "USD", interval);
      const formatted = new Intl.NumberFormat(price.locale, {
        style: "currency",
        currency: price.currency,
        maximumFractionDigits: 0,
      }).format(price.value);
      const suffix = interval === "yearly" ? "/year" : "/month";
      return `${formatted}${suffix} - ${config.title}`;
    },
    [interval],
  );

  // Walk the DOM to update prices in the GFM table headers
  if (typeof window !== "undefined") {
    // Use requestAnimationFrame to run after render
    requestAnimationFrame(() => {
      const tables = document.querySelectorAll(".table-wrapper table");
      for (const table of tables) {
        const headers = table.querySelectorAll("thead th");
        // The pricing table has 4 columns: Features | Hobby | Starter | Pro
        if (headers.length !== 4) continue;

        for (let i = 0; i < planColumns.length; i++) {
          const th = headers[i + 1]; // skip first "Features comparison" column
          if (!th) continue;
          const { plan } = planColumns[i];
          th.textContent = formatPrice(plan);
        }
      }
    });
  }

  return null;
}
