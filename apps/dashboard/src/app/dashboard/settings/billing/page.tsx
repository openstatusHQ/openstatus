import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { DataTable } from "@/components/data-table/billing/data-table";
import { BillingProgress } from "@/components/content/billing-progress";
import { Button } from "@/components/ui/button";
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

export default function Page() {
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
                <BillingProgress label="Monitors" value={6} max={10} />
                <BillingProgress label="Status Pages" value={1} max={1} />
                <BillingProgress label="Notifiers" value={0} max={1} />
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
