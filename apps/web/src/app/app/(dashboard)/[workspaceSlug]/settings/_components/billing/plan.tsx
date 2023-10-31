"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import type { z } from "zod";

import type { Workspace } from "@openstatus/db/src/schema";

import { Shell } from "@/components/dashboard/shell";
import { Plan } from "@/components/marketing/plans";
import type { PlanProps } from "@/config/plans";
import { plansConfig } from "@/config/plans";
import { getStripe } from "@/lib/stripe/client";
import { api } from "@/trpc/client";

export const SettingsPlan = ({
  workspaceSlug,
  workspaceData,
}: {
  workspaceSlug: string;
  workspaceData: Workspace;
}) => {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isPortalPending, startPortalTransition] = useTransition();

  const getCheckoutSession = () => {
    startTransition(async () => {
      const result = await api.stripeRouter.getCheckoutSession.mutate({
        workspaceSlug,
      });
      if (!result) return;

      const stripe = await getStripe();
      stripe?.redirectToCheckout({ sessionId: result.id });
    });
  };

  const getUserCustomerPortal = () => {
    startPortalTransition(async () => {
      const url = await api.stripeRouter.getUserCustomerPortal.mutate({
        workspaceSlug,
      });
      if (!url) return;
      router.push(url);
      return;
    });
  };

  const plans: Record<"free" | "pro", PlanProps> = {
    free: {
      ...plansConfig.free,
      loading: isPortalPending,
      action: {
        text: workspaceData?.plan === "free" ? "Current plan" : "Downgrade",
        onClick: async () => {
          await getUserCustomerPortal();
        },
      },
    },
    pro: {
      ...plansConfig.pro,
      loading: isPending,
      action: {
        text: workspaceData?.plan === "free" ? "Upgrade" : "Current plan",
        onClick: async () => {
          await getCheckoutSession();
        },
      },
    },
  };

  return (
    <Shell className="mt-4 w-full">
      <div className="grid  gap-4 md:grid-cols-2 md:gap-0">
        <Plan
          {...plans.free}
          className="md:border-border/50 md:border-r md:pr-4"
        />
        <Plan {...plans.pro} className="md:pl-4" />
      </div>
    </Shell>
  );
};
