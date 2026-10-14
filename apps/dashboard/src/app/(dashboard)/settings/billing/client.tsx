"use client";

import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import { Button } from "@openstatus/ui/components/ui/button";
import { useCookieState } from "@openstatus/ui/hooks/use-cookie-state";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { BillingAddons } from "@/components/content/billing-addons";
import { BillingProgress } from "@/components/content/billing-progress";
import {
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { DataTable } from "@/components/data-table/billing/data-table";
import { TRIAL_DAYS } from "@/components/dialogs/start-trial";
import { UpgradeIntentDialog } from "@/components/dialogs/upgrade-intent";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardGroup,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "@/components/forms/form-card";
import { formatDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

import { searchParamsParsers } from "./search-params";

function calculateTotalRequests(limits: Limits) {
  const monitors = limits.monitors;
  const maxRegions = limits["max-regions"];
  const periodicity = limits.periodicity;

  if (periodicity.includes("30s")) {
    return monitors * maxRegions * 2 * 60 * 24 * 30;
  }

  if (periodicity.includes("1m")) {
    return monitors * maxRegions * 60 * 24 * 30;
  }

  if (periodicity.includes("5m")) {
    return monitors * maxRegions * 12 * 24 * 30;
  }

  if (periodicity.includes("10m")) {
    return monitors * maxRegions * 6 * 24 * 30;
  }

  if (periodicity.includes("30m")) {
    return monitors * maxRegions * 2 * 24 * 30;
  }

  if (periodicity.includes("1h")) {
    return monitors * maxRegions * 24 * 30;
  }

  return 0;
}

export function Client() {
  const trpc = useTRPC();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const queryClient = useQueryClient();
  const [{ success, setup, trial }, setSearchParams] =
    useQueryStates(searchParamsParsers);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  // Captured on mount: the toasts clear the params while the dialog is open.
  const [askIntent, setAskIntent] = useState(Boolean(success || trial));
  const { data: hasIntent } = useQuery({
    ...trpc.feedback.hasSubmitted.queryOptions({ source: "upgrade-intent" }),
    enabled: askIntent,
  });
  const [currency] = useCookieState("x-currency", "USD");
  const trialCheckoutMutation = useMutation(
    trpc.stripeRouter.getCheckoutSession.mutationOptions({
      onSuccess: (data) => {
        if (data?.type === "checkout" && data.session.url) {
          window.location.assign(data.session.url);
        }
      },
      onError: (error) => toast.error(error.message),
    }),
  );
  const { data: usage } = useQuery(trpc.workspace.usage.queryOptions());
  const paymentMethodSetupMutation = useMutation(
    trpc.stripeRouter.getPaymentMethodSetupSession.mutationOptions({
      onSuccess: (url) => {
        if (url) window.location.assign(url);
      },
      onError: (error) => toast.error(error.message),
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
  const { data: httpWorkspace30d } = useQuery({
    ...trpc.tinybird.workspace30d.queryOptions({
      type: "http",
    }),
    enabled: !!workspace,
  });

  const { data: tcpWorkspace30d } = useQuery({
    ...trpc.tinybird.workspace30d.queryOptions({
      type: "tcp",
    }),
    enabled: !!workspace,
  });

  useEffect(() => {
    if (success) {
      setTimeout(() => {
        toast.success("Billing information updated", {
          duration: 5_000,
          onAutoClose: () => setSearchParams({ success: null }),
          onDismiss: () => setSearchParams({ success: null }),
        });
      }, 500);
    }
  }, [success, setSearchParams]);

  useEffect(() => {
    if (trial) {
      for (const queryKey of [
        trpc.workspace.get.queryKey(),
        trpc.stripeRouter.getBillingInterval.queryKey(),
      ]) {
        queryClient.invalidateQueries({ queryKey });
      }
      setTimeout(() => {
        toast.success(`Your ${TRIAL_DAYS}-day Starter trial has started`, {
          duration: 5_000,
          onAutoClose: () => setSearchParams({ trial: null }),
          onDismiss: () => setSearchParams({ trial: null }),
        });
      }, 500);
    }
  }, [trial, setSearchParams, queryClient, trpc]);

  useEffect(() => {
    if (setup) {
      queryClient.invalidateQueries({
        queryKey: trpc.workspace.get.queryKey(),
      });
      setTimeout(() => {
        toast.success("Payment method added", {
          description: "Your plan continues after the trial.",
          duration: 5_000,
          onAutoClose: () => setSearchParams({ setup: null }),
          onDismiss: () => setSearchParams({ setup: null }),
        });
      }, 500);
    }
  }, [setup, setSearchParams, queryClient, trpc]);

  const totalRequests = useMemo(() => {
    const httpRequests = httpWorkspace30d?.data?.reduce(
      (acc, curr) => acc + curr.count,
      0,
    );
    const tcpRequests = tcpWorkspace30d?.data?.reduce(
      (acc, curr) => acc + curr.count,
      0,
    );
    return (httpRequests ?? 0) + (tcpRequests ?? 0);
  }, [httpWorkspace30d, tcpWorkspace30d]);

  if (!workspace) return null;

  const planAddons = allPlans[workspace.plan].addons;
  const trialDaysLeft = workspace.trialDaysLeft;

  return (
    <SectionGroup>
      <UpgradeIntentDialog
        open={askIntent && hasIntent === false}
        onOpenChange={setAskIntent}
      />
      <Section>
        <SectionHeader>
          <SectionTitle>Billing</SectionTitle>
          <SectionDescription>
            Manage your billing information and payment methods.
          </SectionDescription>
        </SectionHeader>
        <FormCardGroup>
          {workspace?.trial.eligible ? (
            <FormCard>
              <FormCardHeader>
                <FormCardTitle>
                  Try Starter free for {TRIAL_DAYS} days
                </FormCardTitle>
                <FormCardDescription>
                  1 min checks, more monitors, custom domain, Slack and on-call
                  integrations.
                </FormCardDescription>
              </FormCardHeader>
              <FormCardFooter>
                <FormCardFooterInfo>
                  <span className="text-foreground font-medium">
                    No credit card needed.
                  </span>{" "}
                  You will see the price on the next page. The workspace returns
                  to Hobby after {TRIAL_DAYS} days unless you add a card.
                </FormCardFooterInfo>
                <Button
                  size="sm"
                  onClick={() =>
                    trialCheckoutMutation.mutate({
                      trial: true,
                      plan: "starter",
                      interval: "monthly",
                      surface: "billing",
                      currency: currency || "USD",
                      workspaceSlug: workspace.slug,
                      successUrl: `${window.location.origin}/settings/billing?trial=true`,
                      cancelUrl: `${window.location.origin}/settings/billing`,
                    })
                  }
                  disabled={trialCheckoutMutation.isPending}
                >
                  {trialCheckoutMutation.isPending
                    ? "Loading..."
                    : "Start trial"}
                </Button>
              </FormCardFooter>
            </FormCard>
          ) : null}
          {workspace.trialEndsAt && trialDaysLeft ? (
            <FormCard>
              <FormCardHeader>
                <FormCardTitle>Starter trial</FormCardTitle>
                <FormCardDescription>
                  <span className="text-foreground font-medium">
                    {trialDaysLeft}
                  </span>{" "}
                  {trialDaysLeft === 1 ? "day" : "days"} left. Your trial ends
                  on {formatDate(workspace.trialEndsAt)}.
                </FormCardDescription>
              </FormCardHeader>
              <FormCardFooter>
                <FormCardFooterInfo>
                  Add a payment method to keep Starter, or move to the free plan
                  after the trial.
                </FormCardFooterInfo>
                <Button
                  size="sm"
                  onClick={() =>
                    paymentMethodSetupMutation.mutate({
                      workspaceSlug: workspace.slug,
                      successUrl: `${window.location.origin}/settings/billing?setup=true`,
                      cancelUrl: `${window.location.origin}/settings/billing`,
                    })
                  }
                  disabled={paymentMethodSetupMutation.isPending}
                >
                  {paymentMethodSetupMutation.isPending
                    ? "Loading..."
                    : "Add payment method"}
                </Button>
              </FormCardFooter>
            </FormCard>
          ) : null}
          <FormCard>
            <FormCardHeader>
              <FormCardTitle>Usage</FormCardTitle>
              <FormCardDescription>
                Overview of your current usage, limits and addons.
              </FormCardDescription>
            </FormCardHeader>
            <FormCardContent>
              <div className="flex flex-col gap-2">
                <BillingProgress
                  label="Monitors"
                  value={usage?.monitors ?? 0}
                  max={workspace.limits.monitors}
                />
                <BillingProgress
                  label="Status Pages"
                  value={usage?.pages ?? 0}
                  max={workspace.limits["status-pages"]}
                />
                <BillingProgress
                  label="Page Components"
                  value={usage?.pageComponents ?? 0}
                  max={workspace.limits["page-components"]}
                />
                <BillingProgress
                  label="Notifications"
                  value={usage?.notifications ?? 0}
                  max={workspace.limits["notification-channels"]}
                />
                <BillingProgress
                  label="Total requests in the last 30 days"
                  value={totalRequests}
                  max={calculateTotalRequests(workspace.limits)}
                />
              </div>
            </FormCardContent>
            <FormCardSeparator />
            <FormCardContent>
              <FormCardHeader className="col-span-full px-0 pt-0 pb-0">
                <FormCardTitle>Add-ons</FormCardTitle>
                <FormCardDescription>
                  Extend your limits with additional features.
                </FormCardDescription>
              </FormCardHeader>
              <div className="flex flex-col gap-2 pt-4">
                {planAddons["email-domain-protection"] ? (
                  <BillingAddons
                    label={planAddons["email-domain-protection"].title}
                    description={
                      planAddons["email-domain-protection"].description
                    }
                    addon="email-domain-protection"
                    workspace={workspace}
                  />
                ) : null}
                {planAddons["ip-restriction"] ? (
                  <BillingAddons
                    label={planAddons["ip-restriction"].title}
                    description={planAddons["ip-restriction"].description}
                    addon="ip-restriction"
                    workspace={workspace}
                  />
                ) : null}
                {planAddons["white-label"] ? (
                  <BillingAddons
                    label={planAddons["white-label"].title}
                    description={planAddons["white-label"].description}
                    addon="white-label"
                    workspace={workspace}
                  />
                ) : null}
                {planAddons["custom-theme"] ? (
                  <BillingAddons
                    label={planAddons["custom-theme"].title}
                    description={planAddons["custom-theme"].description}
                    addon="custom-theme"
                    workspace={workspace}
                  />
                ) : null}
                {planAddons["status-pages"] ? (
                  <BillingAddons
                    label={planAddons["status-pages"].title}
                    description={planAddons["status-pages"].description}
                    addon="status-pages"
                    workspace={workspace}
                  />
                ) : null}
                {planAddons.monitors ? (
                  <BillingAddons
                    label={planAddons.monitors.title}
                    description={planAddons.monitors.description}
                    addon="monitors"
                    workspace={workspace}
                  />
                ) : null}
                {planAddons.sso ? (
                  <BillingAddons
                    label={planAddons.sso.title}
                    description={planAddons.sso.description}
                    addon="sso"
                    workspace={workspace}
                  />
                ) : null}
                {Object.keys(planAddons).length === 0 ? (
                  <EmptyStateContainer>
                    <EmptyStateTitle>No add-ons available</EmptyStateTitle>
                  </EmptyStateContainer>
                ) : null}
              </div>
            </FormCardContent>
            <FormCardFooter>
              <FormCardFooterInfo>
                Access your{" "}
                <span className="font-medium">billing information</span>,{" "}
                <span className="font-medium">invoices</span> and{" "}
                <span className="font-medium">payment methods</span> via Stripe.
              </FormCardFooterInfo>
              <Button
                size="sm"
                onClick={() => {
                  startTransition(async () => {
                    await customerPortalMutation.mutateAsync({
                      workspaceSlug: workspace.slug,
                      returnUrl: `${window.location.origin}/settings/billing`,
                    });
                  });
                }}
                disabled={isPending}
              >
                {isPending ? "Loading..." : "Customer Portal"}
              </Button>
            </FormCardFooter>
          </FormCard>
          <FormCard>
            <FormCardHeader>
              <FormCardTitle>Plans</FormCardTitle>
              <FormCardDescription>
                Choose a plan that fits your needs.
              </FormCardDescription>
            </FormCardHeader>
            <FormCardSeparator />
            <FormCardContent className="pb-4">
              <DataTable />
            </FormCardContent>
          </FormCard>
        </FormCardGroup>
      </Section>
    </SectionGroup>
  );
}
