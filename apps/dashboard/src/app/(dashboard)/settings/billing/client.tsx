"use client";

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
import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc/client";
import { allPlans } from "@openstatus/db/src/schema/plan/config";
import type { Limits } from "@openstatus/db/src/schema/plan/schema";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useEffect, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { searchParamsParsers } from "./search-params";

const BASE_URL =
  process.env.NODE_ENV === "production"
    ? "https://app.openstatus.dev"
    : "http://localhost:3000";

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
  const [{ success }, setSearchParams] = useQueryStates(searchParamsParsers);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
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

  const addons = allPlans[workspace.plan].addons;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Billing</SectionTitle>
          <SectionDescription>
            Manage your billing information and payment methods.
          </SectionDescription>
        </SectionHeader>
        <FormCardGroup>
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
                  value={workspace.usage?.monitors ?? 0}
                  max={workspace.limits.monitors}
                />
                <BillingProgress
                  label="Status Pages"
                  value={workspace.usage?.pages ?? 0}
                  max={workspace.limits["status-pages"]}
                />
                <BillingProgress
                  label="Notifications"
                  value={workspace.usage?.notifications ?? 0}
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
                {/* TODO: redirect to stripe product */}
                {addons["email-domain-protection"] ? (
                  <BillingAddons
                    label="Magic Link (Auth)"
                    description="Only allow user with a given email domain to access the status page."
                    addon="email-domain-protection"
                    workspace={workspace}
                  />
                ) : null}
                {addons["white-label"] ? (
                  <BillingAddons
                    label="White Label"
                    description="Remove the 'powered by openstatus.dev' footer from your status pages."
                    addon="white-label"
                    workspace={workspace}
                  />
                ) : null}
                {Object.keys(addons).length === 0 ? (
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
                      returnUrl: `${BASE_URL}/settings/billing`,
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
