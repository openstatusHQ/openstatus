"use client";

import { useSearchParams } from "next/navigation";

import type { WorkspacePlan } from "@openstatus/db/src/schema/workspaces/validation";

import { workspacePlans } from "@openstatus/db/src/schema";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import { Suspense } from "react";
import { PricingPlanRadio } from "./pricing-plan-radio";
import { PricingTable } from "./pricing-table";

export function PricingWrapper() {
  const [plan, setPlan] = useQueryState(
    "plan",
    parseAsStringLiteral(workspacePlans).withDefault("team"),
  );
  return (
    <div>
      <div className="flex flex-col gap-4 sm:hidden">
        <PricingPlanRadio onChange={setPlan} />
        <PricingTable plans={[plan]} />
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
