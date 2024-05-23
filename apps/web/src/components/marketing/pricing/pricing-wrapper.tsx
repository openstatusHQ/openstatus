"use client";

import { useSearchParams } from "next/navigation";

import type { WorkspacePlan } from "@openstatus/plans";

import { PricingPlanRadio } from "./pricing-plan-radio";
import { PricingTable } from "./pricing-table";
import { Suspense } from "react";

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

// REMINDER: https://nextjs.org/docs/messages/missing-suspense-with-csr-bailout
// REMINDER: https://nextjs.org/docs/app/api-reference/functions/use-search-params#static-rendering
// REMINDER: https://nextjs.org/docs/messages/deopted-into-client-rendering
// experiments.missingSuspenseWithCSRBailout: false, within next.config.js
export function PricingWrapperSuspense() {
  return (
    <Suspense>
      <PricingWrapper />
    </Suspense>
  );
}
