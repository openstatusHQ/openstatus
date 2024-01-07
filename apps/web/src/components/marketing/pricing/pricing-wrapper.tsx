"use client";

import { useSearchParams } from "next/navigation";

import type { WorkspacePlan } from "@openstatus/plans";

import { PricingPlanRadio } from "./pricing-plan-radio";
import { PricingTable } from "./pricing-table";

export function PricingWrapper() {
  const searchParams = useSearchParams();
  return (
    <div>
      <div className="flex flex-col gap-4 sm:hidden">
        <PricingPlanRadio />
        <PricingTable
          plans={[(searchParams.get("plan") as WorkspacePlan) || "team"]}
        />
      </div>
      <div className="hidden sm:block">
        <PricingTable />
      </div>
    </div>
  );
}
