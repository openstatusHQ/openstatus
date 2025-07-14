"use client";

import { BillingProgress } from "@/components/content/billing-progress";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useTransition } from "react";
import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "./search-params";
import { toast } from "sonner";
import { Limits } from "@openstatus/db/src/schema/plan/schema";

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
    })
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
      0
    );
    const tcpRequests = tcpWorkspace30d?.data?.reduce(
      (acc, curr) => acc + curr.count,
      0
    );
    return (httpRequests ?? 0) + (tcpRequests ?? 0);
  }, [httpWorkspace30d, tcpWorkspace30d]);

  if (!workspace) return null;

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
              <FormCardTitle>Limits</FormCardTitle>
              <FormCardDescription>
                Overview of your current limits.
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
                  label="Notifiers"
                  value={workspace.usage?.notifications ?? 0}
                  max={workspace.limits["notification-channels"]}
                />
              </div>
            </FormCardContent>
            <FormCardSeparator />
            <FormCardContent>
              <div className="flex flex-col gap-2">
                <BillingProgress
                  label="Requests in the last 30 days"
                  value={totalRequests}
                  max={calculateTotalRequests(workspace.limits)}
                />
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
