import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCookieState } from "@/hooks/use-cookie-state";

import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import type { Addons } from "@openstatus/db/src/schema/plan/schema";
import { getAddonPriceConfig } from "@openstatus/db/src/schema/plan/utils";
import { useMutation } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { startTransition } from "react";

const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://app.openstatus.dev"
    : "http://localhost:3000";

type Workspace = RouterOutputs["workspace"]["get"];

interface BillingAddonsProps {
  label: string;
  description: React.ReactNode;
  addon: keyof Addons;
  workspace: Workspace;
}

export function BillingAddons({
  label,
  description,
  addon,
  workspace,
}: BillingAddonsProps) {
  const plan = workspace.plan;
  const value = workspace.limits[addon];
  const [currency] = useCookieState("x-currency", "USD");
  const price = getAddonPriceConfig(plan, addon, currency);
  const trpc = useTRPC();

  const checkoutSessionMutation = useMutation(
    trpc.stripeRouter.addAddon.mutationOptions({}),
  );
  console.log(value);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col justify-between gap-1.5 sm:flex-row">
        <div className="space-y-0.5 text-sm">
          <Label>{label}</Label>
          <div className="truncate text-muted-foreground">{description}</div>
        </div>
        <div className="flex items-center gap-2">
          {value ? <Check className="size-4 text-success" /> : null}
          <span className="font-mono text-foreground text-sm">
            {price
              ? new Intl.NumberFormat(price.locale, {
                  style: "currency",
                  currency: price.currency,
                }).format(price.value)
              : "N/A"}
            /mo.
          </span>
          {value ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                startTransition(async () => {
                  await checkoutSessionMutation.mutateAsync({
                    // TODO HANDLE REMOVE
                    workspaceSlug: workspace.slug,
                    successUrl: `${BASE_URL}/settings/billing?success=true`,
                    cancelUrl: `${BASE_URL}/settings/billing`,
                    feature: addon,
                    remove: true,
                  });
                });
              }}
            >
              Remove
            </Button>
          ) : (
            <Button
              size="sm"
              variant="secondary"
              onClick={() => {
                startTransition(async () => {
                  await checkoutSessionMutation.mutateAsync({
                    workspaceSlug: workspace.slug,
                    successUrl: `${BASE_URL}/settings/billing?success=true`,
                    cancelUrl: `${BASE_URL}/settings/billing`,
                    feature: addon,
                  });
                });
              }}
            >
              Add
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
