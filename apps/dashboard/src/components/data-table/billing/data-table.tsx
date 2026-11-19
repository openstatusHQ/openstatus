"use client";

import {
  TRIAL_DAYS,
  type TrialSurface,
} from "@openstatus/api/src/router/stripe/trial-config";
import type { WorkspacePlan } from "@openstatus/db/src/schema";
import type {
  Addons,
  BillingInterval,
  Limits,
} from "@openstatus/db/src/schema/plan/schema";
import {
  getAddonPackSize,
  getAddonPriceConfig,
  getPlansForLimit,
  getPriceConfig,
} from "@openstatus/db/src/schema/plan/utils";
import { Check, ChevronRight } from "@openstatus/icons";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@openstatus/ui/components/ui/tabs";
import { useCookieState } from "@openstatus/ui/hooks/use-cookie-state";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useRouter } from "next/navigation";
import { Fragment, useState, useTransition } from "react";
import { toast } from "sonner";

import { config as featureGroups, plans } from "@/data/plans";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://app.openstatus.dev"
    : "http://localhost:3001";

const PLAN_ORDER: WorkspacePlan[] = ["free", "starter", "team", "scale"];

function getPeriodSuffix(interval: BillingInterval) {
  return interval === "yearly" ? "/yr." : "/mo.";
}

function getQuantitySuffix(addon: keyof Addons, interval: BillingInterval) {
  const packSize = getAddonPackSize(addon);
  const period = getPeriodSuffix(interval);
  return packSize > 1 ? `${period}/${packSize}` : `${period}/each`;
}

type Plan = (typeof plans)[WorkspacePlan];
type Feature = (typeof featureGroups)[string]["features"][number];

const allFeatures = Object.values(featureGroups).flatMap(
  ({ features }) => features,
);

function FeatureValue({
  plan,
  feature,
  currency,
  interval,
}: {
  plan: Plan;
  feature: Feature;
  currency: string | undefined;
  interval: BillingInterval;
}) {
  const limitValue = plan.limits[feature.value];

  if (feature.value in plan.addons) {
    const addon = feature.value as keyof Addons;
    const price = getAddonPriceConfig(plan.id, addon, currency, interval);
    if (!price) return null;

    const isNumber = typeof limitValue === "number";
    return (
      <div>
        <span>
          {isNumber ? new Intl.NumberFormat("us").format(limitValue) : null}
        </span>
        <span>
          <span className="text-muted-foreground">{isNumber ? " + " : ""}</span>
          <span>
            {new Intl.NumberFormat(price.locale, {
              style: "currency",
              currency: price.currency,
            }).format(price.value)}
            {isNumber
              ? getQuantitySuffix(addon, interval)
              : getPeriodSuffix(interval)}
          </span>
        </span>
      </div>
    );
  }
  if (typeof limitValue === "boolean") {
    return limitValue ? (
      <Check className="text-foreground h-4 w-4" />
    ) : (
      <span className="text-muted-foreground/50">&#8208;</span>
    );
  }
  if (typeof limitValue === "number") {
    return new Intl.NumberFormat("us").format(limitValue);
  }
  if (feature.value === "regions" && Array.isArray(limitValue)) {
    return limitValue.length;
  }
  if (Array.isArray(limitValue)) return limitValue[0] ?? null;
  return limitValue ?? null;
}

function FeatureCells({
  feature,
  plans: columns,
  recommended,
  currency,
  interval,
}: {
  feature: Feature;
  plans: Plan[];
  recommended?: WorkspacePlan;
  currency: string | undefined;
  interval: BillingInterval;
}) {
  return (
    <>
      <TableCell className="in-data-[slot=dialog-content]:pl-6">
        <div className="flex items-center gap-2 text-wrap">
          {feature.label}{" "}
          {feature.badge ? (
            <Badge variant="outline">{feature.badge}</Badge>
          ) : null}
        </div>
      </TableCell>
      {columns.map((plan) => (
        <TableCell
          key={plan.id}
          className={cn("font-mono", plan.id === recommended && "bg-muted/30")}
        >
          <FeatureValue
            plan={plan}
            feature={feature}
            currency={currency}
            interval={interval}
          />
          {feature.monthly ? "/mo." : ""}
        </TableCell>
      ))}
    </>
  );
}

export function DataTable({
  restrictTo,
  surface = "plan_table",
  highlight,
  collapsed = false,
  className,
}: {
  restrictTo?: WorkspacePlan[];
  surface?: TrialSurface;
  /** Limit whose row is pinned under the plan header. */
  highlight?: string | null;
  /** Start with only the highlighted (or first) group expanded. */
  collapsed?: boolean;
  className?: string;
}) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [currency] = useCookieState("x-currency", "USD");
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [isPending, startTransition] = useTransition();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const intervalQuery = useQuery(
    trpc.stripeRouter.getBillingInterval.queryOptions(),
  );
  const currentInterval = intervalQuery.data;
  const canTrial = workspace?.trial.eligible === true;

  const checkoutSessionMutation = useMutation(
    trpc.stripeRouter.getCheckoutSession.mutationOptions({
      onSuccess: async (data) => {
        if (!data) return;

        // An existing subscriber has the plan swapped on the subscription they
        // already have, so there is no checkout to redirect to — only the
        // refreshed workspace to pick up.
        if (data.type === "updated") {
          await Promise.all([
            queryClient.invalidateQueries({
              queryKey: trpc.workspace.get.queryKey(),
            }),
            queryClient.invalidateQueries({
              queryKey: trpc.stripeRouter.getBillingInterval.queryKey(),
            }),
          ]);
          toast.success("Your plan has been updated");
          return;
        }

        if (data.session.url) window.location.assign(data.session.url);
      },
    }),
  );

  const customerPortalMutation = useMutation(
    trpc.stripeRouter.getUserCustomerPortal.mutationOptions({
      onSuccess: (url) => {
        if (!url) return;
        router.push(url);
      },
    }),
  );

  // Which button is in flight, derived from the running mutation.
  const pendingPlan: WorkspacePlan | null = checkoutSessionMutation.isPending
    ? checkoutSessionMutation.variables.plan
    : customerPortalMutation.isPending
      ? "free"
      : null;

  if (!workspace) return null;

  const isTrialing = workspace.trialDaysLeft !== null;
  const filteredPlans = Object.values(plans).filter((plan) =>
    restrictTo ? restrictTo.includes(plan.id) : true,
  );
  const pinned = allFeatures.find((feature) => feature.value === highlight);
  const upgrades = pinned
    ? getPlansForLimit(workspace.plan, pinned.value as keyof Limits)
    : PLAN_ORDER.slice(PLAN_ORDER.indexOf(workspace.plan) + 1);
  const recommended = upgrades.find((id) =>
    filteredPlans.some((plan) => plan.id === id),
  );
  const defaultOpenGroup = pinned
    ? Object.entries(featureGroups).find(([, group]) =>
        group.features.includes(pinned),
      )?.[0]
    : Object.keys(featureGroups)[0];

  return (
    <div className={cn("flex min-w-0 flex-col gap-4", className)}>
      <Tabs
        value={interval}
        onValueChange={(v) => setInterval(v as BillingInterval)}
        className="in-data-[slot=dialog-content]:px-6"
      >
        <TabsList>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
          <TabsTrigger value="yearly">
            Yearly <Badge className="ml-1.5 text-[10px]">2 months free</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>
      {/* Not `Table`: its own overflow wrapper would trap the sticky header. */}
      <div
        data-slot="table-container"
        className="relative min-h-0 w-full flex-1 overflow-auto in-data-[slot=dialog-content]:border-t"
      >
        <table data-slot="table" className="w-full caption-bottom text-sm">
          <TableCaption className="in-data-[slot=dialog-content]:pb-4">
            {isTrialing
              ? "Upgrading ends your trial and charges your card today."
              : canTrial &&
                  interval === "monthly" &&
                  filteredPlans.some(({ id }) => id === "starter")
                ? `Starter can be tried free for ${TRIAL_DAYS} days, no credit card needed.`
                : "A list to compare the different features by plan."}
          </TableCaption>
          <TableHeader className="bg-background sticky top-0 z-10 [&_td]:shadow-[inset_0_-1px_0_var(--color-border)] [&_th]:shadow-[inset_0_-1px_0_var(--color-border)] [&_tr]:border-0">
            <TableRow className="hover:bg-transparent">
              <TableHead className="min-w-40 p-2 align-bottom in-data-[slot=dialog-content]:pl-6">
                Features comparison
              </TableHead>
              {filteredPlans.map(({ id, ...plan }) => {
                const isFreePlan = id === "free";
                const isSamePlan = workspace.plan === id;
                // Hold the paid plan's button until the interval is known, so it
                // never flashes "Current Plan" on the wrong tab.
                const isIntervalLoading =
                  isSamePlan && !isFreePlan && intervalQuery.isPending;
                // A resolved `null` (no subscription, legacy price) matches on the
                // plan alone. A failed fetch leaves both intervals selectable:
                // re-applying the price the customer already pays is a no-op.
                const isCurrentPlan =
                  isSamePlan &&
                  (isFreePlan ||
                    (intervalQuery.isSuccess &&
                      (currentInterval === null ||
                        currentInterval === interval)));
                const isIntervalSwitch =
                  isSamePlan &&
                  intervalQuery.isSuccess &&
                  currentInterval !== null &&
                  currentInterval !== interval;
                const price = getPriceConfig(id, currency, interval);
                const isTrialOffer =
                  canTrial && id === "starter" && interval === "monthly";
                return (
                  <TableHead
                    key={id}
                    className={cn(
                      "text-foreground h-auto min-w-40 p-2 align-bottom",
                      id === recommended ? "bg-muted/30" : "",
                    )}
                  >
                    <div className="flex h-full flex-col justify-between gap-1">
                      <div className="flex flex-1 flex-col gap-1">
                        <p className="font-cal text-lg">{plan.title}</p>
                        <p className="text-muted-foreground text-xs font-normal text-wrap in-data-[slot=dialog-content]:hidden">
                          {plan.description}
                        </p>
                        {isTrialOffer ? (
                          <p className="text-xs font-normal text-wrap">
                            Free for {TRIAL_DAYS} days. No credit card needed.
                          </p>
                        ) : null}
                      </div>
                      <div className="text-right">
                        {isFreePlan ? (
                          <p className="font-mono text-lg">Free</p>
                        ) : (
                          <p>
                            <span className="font-mono text-lg">
                              {new Intl.NumberFormat(price.locale, {
                                style: "currency",
                                currency: price.currency,
                              }).format(price.value)}
                            </span>
                            <span className="text-muted-foreground text-sm">
                              {interval === "yearly" ? "/year" : "/month"}
                            </span>
                          </p>
                        )}
                      </div>
                      <Button
                        size="sm"
                        type="button"
                        variant={id === recommended ? "default" : "outline"}
                        onClick={() => {
                          startTransition(async () => {
                            try {
                              if (isTrialOffer) {
                                await checkoutSessionMutation.mutateAsync({
                                  trial: true,
                                  plan: "starter",
                                  interval: "monthly",
                                  surface,
                                  currency: currency || "USD",
                                  workspaceSlug: workspace.slug,
                                  successUrl: `${BASE_URL}/settings/billing?trial=true`,
                                  cancelUrl: `${BASE_URL}/settings/billing`,
                                });
                                return;
                              }
                              if (id === "free") {
                                await customerPortalMutation.mutateAsync({
                                  workspaceSlug: workspace.slug,
                                  returnUrl: `${BASE_URL}/settings/billing`,
                                });
                                return;
                              }
                              await checkoutSessionMutation.mutateAsync({
                                currency: currency || "USD",
                                plan: id,
                                interval,
                                workspaceSlug: workspace.slug,
                                successUrl: `${BASE_URL}/settings/billing?success=true`,
                                cancelUrl: `${BASE_URL}/settings/billing`,
                              });
                            } catch (error) {
                              toast.error(
                                isTRPCClientError(error)
                                  ? error.message
                                  : "Failed to update your plan",
                              );
                            }
                          });
                        }}
                        disabled={
                          isPending || isCurrentPlan || isIntervalLoading
                        }
                      >
                        {isIntervalLoading
                          ? "Loading..."
                          : isCurrentPlan
                            ? isTrialing
                              ? "On Trial"
                              : "Current Plan"
                            : pendingPlan === id
                              ? "Choosing..."
                              : isIntervalSwitch
                                ? `Switch to ${interval}`
                                : isTrialOffer
                                  ? `Start ${TRIAL_DAYS}-day trial`
                                  : isTrialing && !isFreePlan
                                    ? "Upgrade now"
                                    : "Choose"}
                      </Button>
                    </div>
                  </TableHead>
                );
              })}
            </TableRow>
            {pinned ? (
              <TableRow
                data-slot="pinned-row"
                className="bg-info/10 hover:bg-info/10 font-medium"
              >
                <FeatureCells
                  feature={pinned}
                  plans={filteredPlans}
                  currency={currency}
                  interval={interval}
                />
              </TableRow>
            ) : null}
          </TableHeader>
          <TableBody>
            {Object.entries(featureGroups).map(
              ([groupKey, { label, features }]) => {
                const rows = features.filter((feature) => feature !== pinned);
                const isOpen =
                  openGroups[groupKey] ??
                  (!collapsed || groupKey === defaultOpenGroup);
                if (rows.length === 0) return null;
                return (
                  <Fragment key={groupKey}>
                    <TableRow className="bg-muted/50">
                      <TableCell
                        colSpan={filteredPlans.length + 1}
                        className="p-0"
                      >
                        <button
                          type="button"
                          aria-expanded={isOpen}
                          onClick={() =>
                            setOpenGroups((prev) => ({
                              ...prev,
                              [groupKey]: !isOpen,
                            }))
                          }
                          className="group flex w-full items-center gap-2 p-2 text-left font-medium in-data-[slot=dialog-content]:pl-6"
                        >
                          <ChevronRight className="text-muted-foreground size-3.5 transition-transform duration-150 ease-out group-aria-expanded:rotate-90 motion-reduce:transition-none" />
                          {label}
                          <span className="text-muted-foreground font-mono text-xs font-normal">
                            {rows.length}
                          </span>
                        </button>
                      </TableCell>
                    </TableRow>
                    {isOpen
                      ? rows.map((feature) => (
                          <TableRow key={groupKey + feature.value}>
                            <FeatureCells
                              feature={feature}
                              plans={filteredPlans}
                              recommended={recommended}
                              currency={currency}
                              interval={interval}
                            />
                          </TableRow>
                        ))
                      : null}
                  </Fragment>
                );
              },
            )}
          </TableBody>
        </table>
      </div>
    </div>
  );
}
