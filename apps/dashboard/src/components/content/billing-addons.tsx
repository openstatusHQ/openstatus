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
} from "@openstatus/ui/components/ui/alert-dialog";
import { Button } from "@openstatus/ui/components/ui/button";
import { Label } from "@openstatus/ui/components/ui/label";
import { useCookieState } from "@openstatus/ui/hooks/use-cookie-state";

import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Addons } from "@openstatus/db/src/schema/plan/schema";
import { getAddonPriceConfig } from "@openstatus/db/src/schema/plan/utils";
import { ButtonGroup } from "@openstatus/ui/components/ui/button-group";
import { Input } from "@openstatus/ui/components/ui/input";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { Check, MinusIcon, PlusIcon } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

type Workspace = RouterOutputs["workspace"]["get"];

interface BillingAddonsProps {
  label: string;
  description: React.ReactNode;
  addon: keyof Addons;
  workspace: Workspace;
}

interface PriceConfig {
  value: number;
  currency: string;
  locale: string;
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
  const defaultLimit = allPlans[workspace.plan].limits[addon];
  const workspaceLimit = workspace.limits[addon];
  const defaultValue =
    typeof workspaceLimit === "number" && typeof defaultLimit === "number"
      ? // current value - default value to evaluate the difference
        workspaceLimit - defaultLimit
      : workspaceLimit;
  const [value, setValue] = useState<number | boolean>(defaultValue);
  const price = getAddonPriceConfig(plan, addon, currency);

  // Reset value when modal opens
  useEffect(() => {
    if (open) {
      setValue(defaultValue);
    }
  }, [open, defaultValue]);

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
            return "Billing information updated";
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
  const hasAddon =
    typeof defaultValue === "number"
      ? defaultValue > 0
      : defaultValue !== defaultLimit;
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
              {formatPrice(price)}
              {isQuantity ? "/mo./each" : "/mo."}
            </span>
            {hasAddon && !isQuantity ? (
              <Check className="size-4 text-success" />
            ) : null}
            {hasAddon && isQuantity ? (
              <span className="font-mono text-success">+{defaultValue}</span>
            ) : null}
          </div>
          <div className="col-span-2 flex items-center justify-end gap-1.5 lg:col-span-1">
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="secondary">
                {getButtonLabel(hasAddon, value)}
              </Button>
            </AlertDialogTrigger>
          </div>
        </div>
      </div>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}</AlertDialogTitle>
          <AlertDialogDescription>
            {getDialogDescription(label, price, value, hasAddon)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {isQuantity &&
        typeof value === "number" &&
        typeof defaultLimit === "number" ? (
          <QuantityControl
            value={value}
            setValue={setValue}
            defaultLimit={defaultLimit}
          />
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              submitAction();
            }}
            disabled={
              isPending ||
              (typeof value === "number" &&
                typeof defaultValue === "number" &&
                value === defaultValue)
            }
          >
            {getButtonLabel(hasAddon, value, isPending)}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// NOTE: could move to lib/formatter.ts
function formatPrice(price: PriceConfig | null) {
  if (!price) return "N/A";
  return new Intl.NumberFormat(price.locale, {
    style: "currency",
    currency: price.currency,
  }).format(price.value);
}

function getButtonLabel(
  hasAddon: boolean,
  value: number | boolean,
  isPending = false,
) {
  if (isPending) return "Updating...";

  const isBoolean = typeof value === "boolean";
  const isQuantity = typeof value === "number";

  if (isQuantity) return "Update";

  if (isBoolean) {
    return hasAddon ? "Remove" : "Add";
  }

  return null;
}

function getDialogDescription(
  label: string,
  price: PriceConfig | null,
  value: number | boolean,
  hasAddon: boolean,
) {
  const formattedPrice = formatPrice(price);
  const isBoolean = typeof value === "boolean";
  const isQuantity = typeof value === "number";
  const priceSuffix = isQuantity ? "/mo./each" : "/mo.";

  if (isBoolean) {
    if (hasAddon) {
      return `${label} will be removed from your subscription. You will save ${formattedPrice}${priceSuffix} on your next billing cycle.`;
    }
    return `${label} will be added to your subscription. You will be charged an additional ${formattedPrice}${priceSuffix} on your next billing cycle.`;
  }

  if (isQuantity) {
    return `${label} will be updated to ${value} on your next billing cycle. You will be charged ${formattedPrice}${priceSuffix} on your next billing cycle.`;
  }
}

function QuantityControl({
  value,
  setValue,
  defaultLimit,
}: {
  value: number;
  setValue: (value: number) => void;
  defaultLimit: number | boolean;
}) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number.parseInt(e.target.value);
    if (Number.isNaN(newValue)) {
      setValue(typeof defaultLimit === "number" ? defaultLimit : 0);
    } else {
      setValue(
        Math.max(typeof defaultLimit === "number" ? defaultLimit : 0, newValue),
      );
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 py-2">
      <ButtonGroup aria-label="Quantity" className="h-fit">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setValue(value - 1)}
          disabled={value <= 0}
        >
          <MinusIcon />
        </Button>
        <Input
          type="number"
          value={value}
          className="w-16 text-right"
          step={1}
          min={0}
          onChange={handleChange}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setValue(value + 1)}
        >
          <PlusIcon />
        </Button>
      </ButtonGroup>
    </div>
  );
}
