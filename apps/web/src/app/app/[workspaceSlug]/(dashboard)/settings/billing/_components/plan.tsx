"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import type { Workspace, WorkspacePlan } from "@openstatus/db/src/schema";

import { PricingTable } from "@/components/marketing/pricing/pricing-table";
import { getStripe } from "@/lib/stripe/client";
import { api } from "@/trpc/client";

export const SettingsPlan = ({ workspace }: { workspace: Workspace }) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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
    startTransition(async () => {
      const url = await api.stripeRouter.getUserCustomerPortal.mutate({
        workspaceSlug: workspace.slug,
      });
      if (!url) return;
      router.push(url);
      return;
    });
  };

  return (
    <PricingTable
      currentPlan={workspace.plan}
      isLoading={isPending}
      events={{
        // REMINDER: redirecting to customer portal as a fallback because the free plan has no price
        free: getUserCustomerPortal,
        starter: () => getCheckoutSession("starter"),
        pro: () => getCheckoutSession("pro"),
        team: () => getCheckoutSession("team"),
      }}
    />
  );
};
