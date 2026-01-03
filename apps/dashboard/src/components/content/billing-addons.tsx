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

import { ButtonGroup } from "@/components/ui/button-group";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Addons } from "@openstatus/db/src/schema/plan/schema";
import { getAddonPriceConfig } from "@openstatus/db/src/schema/plan/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { Check, MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "../ui/input";

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
  const defaultWorkspaceValue = workspace.limits[addon];
  const [value, setValue] = useState<number | boolean>(defaultWorkspaceValue);
  const defaultPlanValue = allPlans[plan].limits[addon];
  const price = getAddonPriceConfig(plan, addon, currency);
  const hasAddon = defaultWorkspaceValue !== defaultPlanValue;

  useEffect(() => {
    setValue(defaultWorkspaceValue);
  }, [defaultWorkspaceValue]);

  function submitAction() {
    startTransition(async () => {
      try {
        // toggle the value if it's a boolean otherwise use the value
        const newValue = typeof value === "boolean" ? !value : value;
        const promise = checkoutSessionMutation.mutateAsync({
          workspaceSlug: workspace.slug,
          feature: addon,
          value: newValue,
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

  const isQuantity = typeof value === "number";

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-5">
          <div className="col-span-3 space-y-0.5 text-sm">
            <Label>{label}</Label>
            <div className="text-muted-foreground">{description}</div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-foreground text-sm">
              {price
                ? new Intl.NumberFormat(price.locale, {
                    style: "currency",
                    currency: price.currency,
                  }).format(price.value)
                : "N/A"}
              {isQuantity ? "/mo./each" : "/mo."}
            </span>
            {hasAddon ? <Check className="size-4 text-success" /> : null}
          </div>
          <div className="col-span-2 flex items-center justify-end gap-1.5 lg:col-span-1">
            {typeof value === "number" &&
            typeof defaultPlanValue === "number" &&
            typeof defaultWorkspaceValue === "number" ? (
              <>
                <ButtonGroup aria-label="Quantity" className="h-fit">
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setValue(value - 1)}
                    disabled={value === defaultPlanValue}
                  >
                    <MinusIcon />
                  </Button>
                  <Input
                    type="number"
                    value={value}
                    className="h-8 w-16 text-right"
                    step={1}
                    min={defaultPlanValue}
                    onChange={(e) => {
                      const value = Number.parseInt(e.target.value);
                      if (Number.isNaN(value)) {
                        setValue(defaultPlanValue);
                      } else {
                        setValue(
                          Math.max(
                            typeof defaultPlanValue === "number"
                              ? defaultPlanValue
                              : 0,
                            value,
                          ),
                        );
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="icon-sm"
                    onClick={() => setValue(value + 1)}
                  >
                    <PlusIcon />
                  </Button>
                </ButtonGroup>
                <AlertDialogTrigger asChild>
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={value === defaultWorkspaceValue}
                  >
                    {value >= defaultWorkspaceValue ? "Add" : "Remove"}
                  </Button>
                </AlertDialogTrigger>
              </>
            ) : null}
            {typeof value === "boolean" ? (
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="secondary">
                  {defaultWorkspaceValue ? "Remove" : "Add"}
                </Button>
              </AlertDialogTrigger>
            ) : null}
          </div>
        </div>
      </div>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>
            {hasAddon ? (
              <>
                {label} will be removed from your subscription. You will save{" "}
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
                {label} will be added to your subscription. You will be charged
                an additional{" "}
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
            {isPending ? "Updating..." : hasAddon ? "Remove" : "Add"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
