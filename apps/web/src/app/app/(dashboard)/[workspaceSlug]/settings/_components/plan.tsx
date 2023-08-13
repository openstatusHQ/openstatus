"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { z } from "zod";

import type { selectWorkspaceSchema } from "@openstatus/db/src/schema/workspace";

import { Shell } from "@/components/dashboard/shell";
import { Button } from "@/components/ui/button";
import { getStripe } from "@/lib/stripe/client";
import { cn } from "@/lib/utils";
import { api } from "@/trpc/client";

interface Plan {
  title: string;
  description: string;
  cost: number | string;
  features: string[];
  action: {
    text: string;
    onClick: () => void;
  };
  loading?: boolean;
}

interface Props extends Plan {
  className?: string;
}
export const SettingsPlan = ({
  workspaceSlug,
  workspaceData,
}: {
  workspaceSlug: string;
  workspaceData: z.infer<typeof selectWorkspaceSchema>;
}) => {
  const router = useRouter();

  const [isPending, startTransition] = useTransition();

  const getCheckoutSession = () => {
    startTransition(async () => {
      const result = await api.stripeRouter.getCheckoutSession.mutate({
        workspaceId: workspaceSlug,
      });
      if (!result) return;

      const stripe = await getStripe();
      stripe?.redirectToCheckout({ sessionId: result.id });
    });
  };
  const getUserCustomerPortal = async () => {
    const url = await api.stripeRouter.getUserCustomerPortal.mutate({
      workspaceId: workspaceSlug,
    });
    if (!url) return;
    router.push(url);
    return;
  };
  getUserCustomerPortal;
  const plans: Record<"free" | "pro", Plan> = {
    free: {
      title: "Free",
      description: "Get started now and upgrade once reaching the limits.",
      cost: 0,
      features: [
        "5 monitors",
        "1 status page",
        "subdomain",
        "10m, 30m, 1h checks",
      ],
      action: {
        text: workspaceData?.plan === "free" ? "Current plan" : "Downgrade",
        onClick: async () => {
          await getUserCustomerPortal();
        },
      },
    },
    pro: {
      title: "Pro",
      description: "Scale and build monitors for all your services.",
      cost: 29,
      features: [
        "20 monitors",
        "5 status page",
        "custom domain",
        "1m, 5m, 10m, 30m, 1h checks",
        "5 team members",
      ],
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

export function Plan({
  title,
  description,
  cost,
  features,
  action,
  loading,
  className,
}: Props) {
  return (
    <div key={title} className={cn("flex w-full flex-col", className)}>
      <div className="flex-1">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="font-cal mb-2 text-xl">{title}</p>
            <p className="text-muted-foreground">{description}</p>
          </div>
          <p className="shrink-0">
            <span className="font-cal text-2xl">{cost}</span>
            {typeof cost === "number" ? (
              <span className="text-muted-foreground font-light">/month</span>
            ) : null}
          </p>
        </div>
        <ul className="border-border/50 grid divide-y py-2">
          {features.map((item) => (
            <li
              key={item}
              className="text-muted-foreground inline-flex items-center py-2 text-sm"
            >
              <Check className="mr-2 h-4 w-4 text-green-500" />
              {item}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <Button size="sm" onClick={action.onClick} disabled={loading}>
          {action.text}
        </Button>
      </div>
    </div>
  );
}
