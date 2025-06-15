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
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";

export default function Page() {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());

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
            <FormCardFooter>
              <FormCardFooterInfo>
                Access your{" "}
                <span className="font-medium">billing information</span>,
                <span className="font-medium">invoices</span> and{" "}
                <span className="font-medium">payment methods</span> via Stripe.
              </FormCardFooterInfo>
              <Button size="sm">Customer Portal</Button>
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
