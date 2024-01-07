"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

import type { Workspace, WorkspacePlan } from "@openstatus/db/src/schema";
import { Button } from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { PricingTable } from "@/components/marketing/pricing/pricing-table";
import { getStripe } from "@/lib/stripe/client";
import { api } from "@/trpc/client";

export const SettingsPlan = ({ workspace }: { workspace: Workspace }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPortalPending, startPortalTransition] = useTransition();

  const getCheckoutSession = (plan: WorkspacePlan) => {
    startTransition(async () => {
      const result = await api.stripeRouter.getCheckoutSession.mutate({
        workspaceSlug: workspace.slug,
        plan,
      });
      if (!result) return;

      const stripe = await getStripe();
      stripe?.redirectToCheckout({
        sessionId: result.id,
      });
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
            {isPortalPending ? (
              <LoadingAnimation variant="inverse" />
            ) : (
              "Customer Portal"
            )}
          </Button>
        </div>
        <PricingTable
          currentPlan={workspace.plan}
          isLoading={isPending}
          events={{
            free: () => getCheckoutSession("free"),
            starter: () => getCheckoutSession("starter"),
            pro: () => getCheckoutSession("pro"),
            team: () => getCheckoutSession("team"),
          }}
        />
      </div>
    </div>
  );
};
