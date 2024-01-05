"use client";

import { useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import type { Workspace } from "@openstatus/db/src/schema";
import { Button } from "@openstatus/ui";

import { PricingTable } from "@/components/marketing/pricing/pricing-table";
import { getStripe } from "@/lib/stripe/client";
import { api } from "@/trpc/client";
import { ChangePlanButton } from "./change-plan-button";

export const SettingsPlan = ({ workspace }: { workspace: Workspace }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPortalPending, startPortalTransition] = useTransition();

  const getCheckoutSession = () => {
    startTransition(async () => {
      const result = await api.stripeRouter.getCheckoutSession.mutate({
        workspaceSlug: workspace.slug,
      });
      if (!result) return;

      const stripe = await getStripe();
      stripe?.redirectToCheckout({ sessionId: result.id });
    });
  };

  const getUserCustomerPortal = () => {
    startPortalTransition(async () => {
      const url = await api.stripeRouter.getUserCustomerPortal.mutate({
        workspaceSlug: workspace.slug,
      });
      if (!url) return;
      router.push(url);
      return;
    });
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-6">
        <div>
          <Button onClick={getUserCustomerPortal} variant="outline">
            Customer Portal
          </Button>
          {/* <Button onClick={getCheckoutSession}>Checkout Session</Button> */}
          {/* <ChangePlanButton workspace={workspace} /> */}
        </div>
        <PricingTable
          currentPlan={workspace.plan}
          events={{
            free: () => {},
            starter: () => {},
            pro: () => {},
            team: () => {},
          }}
        />
      </div>
    </div>
  );
};
