import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useCookieState } from "@/hooks/use-cookie-state";

import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import type { Addons } from "@openstatus/db/src/schema/plan/schema";
import { getAddonPriceConfig } from "@openstatus/db/src/schema/plan/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";

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
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [currency] = useCookieState("x-currency", "USD");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const checkoutSessionMutation = useMutation(
    trpc.stripeRouter.addAddon.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.workspace.get.queryKey(),
        });
      },
    }),
  );

  const plan = workspace.plan;
  const value = workspace.limits[addon];
  const price = getAddonPriceConfig(plan, addon, currency);

  function submitAction() {
    startTransition(async () => {
      try {
        const promise = checkoutSessionMutation.mutateAsync({
          workspaceSlug: workspace.slug,
          successUrl: `${BASE_URL}/settings/billing?success=true`,
          cancelUrl: `${BASE_URL}/settings/billing`,
          feature: addon,
          remove: value,
        });
        toast.promise(promise, {
          loading: "Updating...",
          success: () => {
            setOpen(false);
            return value ? "Removed" : "Added";
          },
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return "Failed to update";
          },
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

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
          <AlertDialog open={open} onOpenChange={setOpen}>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="secondary">
                {value ? "Remove" : "Add"}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{label}</AlertDialogTitle>
                <AlertDialogDescription>
                  {value ? (
                    <>
                      {label} will be removed from your subscription. You will
                      save{" "}
                      {price
                        ? new Intl.NumberFormat(price.locale, {
                            style: "currency",
                            currency: price.currency,
                          }).format(price.value)
                        : "N/A"}
                      /mo. on your next billing cycle.
                    </>
                  ) : (
                    <>
                      {label} will be added to your subscription. You will be
                      charged an additional{" "}
                      {price
                        ? new Intl.NumberFormat(price.locale, {
                            style: "currency",
                            currency: price.currency,
                          }).format(price.value)
                        : "N/A"}
                      /mo. on your next billing cycle.
                    </>
                  )}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={(e) => {
                    e.preventDefault();
                    submitAction();
                  }}
                  disabled={isPending}
                >
                  {isPending ? "Updating..." : value ? "Remove" : "Add"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}
