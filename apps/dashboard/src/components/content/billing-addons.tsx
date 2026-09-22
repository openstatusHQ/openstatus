import type { RouterOutputs } from "@openstatus/api";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Addons } from "@openstatus/db/src/schema/plan/schema";
import {
  getAddonMaxQuantity,
  getAddonPackSize,
  getAddonPriceConfig,
} from "@openstatus/db/src/schema/plan/utils";
import { Check, Remove, Add } from "@openstatus/icons";
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
import { ButtonGroup } from "@openstatus/ui/components/ui/button-group";
import { Input } from "@openstatus/ui/components/ui/input";
import { Label } from "@openstatus/ui/components/ui/label";
import { useCookieState } from "@openstatus/ui/hooks/use-cookie-state";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

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

const QUANTITY_UNIT_LABEL: Partial<Record<keyof Addons, string>> = {
  monitors: "monitors",
  "status-pages": "status pages",
};

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
  const packSize = getAddonPackSize(addon);
  const maxPacks = getAddonMaxQuantity(addon);
  const unitLabel = QUANTITY_UNIT_LABEL[addon] ?? "units";
  const defaultLimit = allPlans[workspace.plan].limits[addon];
  const workspaceLimit = workspace.limits[addon];
  const defaultValue =
    typeof workspaceLimit === "number" && typeof defaultLimit === "number"
      ? // packs held today; floored so a hand-edited limit that is not a whole
        // number of packs still renders a sane count
        Math.floor((workspaceLimit - defaultLimit) / packSize)
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
            <span className="text-foreground font-mono text-sm">
              {formatPrice(price)}
              {getPriceSuffix(isQuantity, packSize)}
            </span>
            {hasAddon && !isQuantity ? (
              <Check className="text-success size-4" />
            ) : null}
            {hasAddon && isQuantity && typeof defaultValue === "number" ? (
              <span className="text-success font-mono">
                +{defaultValue * packSize}
              </span>
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
            {getDialogDescription(
              label,
              price,
              value,
              hasAddon,
              packSize,
              unitLabel,
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {isQuantity && typeof value === "number" ? (
          <QuantityControl
            value={value}
            setValue={setValue}
            maxValue={maxPacks}
            packSize={packSize}
            unitLabel={unitLabel}
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
function formatAmount(price: PriceConfig | null, amount: number) {
  if (!price) return "N/A";
  return new Intl.NumberFormat(price.locale, {
    style: "currency",
    currency: price.currency,
  }).format(amount);
}

function formatPrice(price: PriceConfig | null) {
  if (!price) return "N/A";
  return formatAmount(price, price.value);
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

function getPriceSuffix(isQuantity: boolean, packSize: number) {
  if (!isQuantity) return "/mo.";
  return packSize > 1 ? `/mo./pack of ${packSize}` : "/mo./each";
}

function getDialogDescription(
  label: string,
  price: PriceConfig | null,
  value: number | boolean,
  hasAddon: boolean,
  packSize: number,
  unitLabel: string,
) {
  const formattedPrice = formatPrice(price);
  const isBoolean = typeof value === "boolean";
  const isQuantity = typeof value === "number";
  const priceSuffix = getPriceSuffix(isQuantity, packSize);

  if (isBoolean) {
    if (hasAddon) {
      return `${label} will be removed from your subscription. You will save ${formattedPrice}${priceSuffix} on your next billing cycle.`;
    }
    return `${label} will be added to your subscription. You will be charged an additional ${formattedPrice}${priceSuffix} on your next billing cycle.`;
  }

  if (isQuantity) {
    if (value === 0) {
      return `${label} will be removed from your subscription. You will stop being charged for it on your next billing cycle.`;
    }
    const total = formatAmount(price, price ? price.value * value : 0);
    return `Your workspace will get ${value * packSize} extra ${unitLabel}. You will be charged ${total}/mo., starting on your next billing cycle.`;
  }
}

function QuantityControl({
  value,
  setValue,
  maxValue,
  packSize,
  unitLabel,
}: {
  value: number;
  setValue: (value: number) => void;
  maxValue: number | null;
  packSize: number;
  unitLabel: string;
}) {
  const clamp = (next: number) => {
    const floored = Math.max(0, next);
    return maxValue === null ? floored : Math.min(maxValue, floored);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = Number.parseInt(e.target.value);
    setValue(Number.isNaN(newValue) ? 0 : clamp(newValue));
  };

  const atMax = maxValue !== null && value >= maxValue;

  return (
    <div className="flex flex-col items-center gap-2 py-2">
      <ButtonGroup aria-label="Quantity" className="h-fit">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setValue(clamp(value - 1))}
          disabled={value <= 0}
        >
          <Remove />
        </Button>
        <Input
          type="number"
          value={value}
          className="w-16 text-right"
          step={1}
          min={0}
          max={maxValue ?? undefined}
          onChange={handleChange}
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => setValue(clamp(value + 1))}
          disabled={atMax}
        >
          <Add />
        </Button>
      </ButtonGroup>
      {atMax && maxValue !== null ? (
        <p className="text-muted-foreground text-xs">
          Need more than {maxValue * packSize} extra {unitLabel}?{" "}
          <a
            href="https://openstatus.dev/cal"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-4"
          >
            Book a call
          </a>
        </p>
      ) : null}
    </div>
  );
}
