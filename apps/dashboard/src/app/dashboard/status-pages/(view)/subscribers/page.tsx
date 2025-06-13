import { Link } from "@/components/common/link";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayContainer,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";

import { Section } from "@/components/content/section";
import { columns } from "@/components/data-table/subscribers/columns";
import { DataTable } from "@/components/ui/data-table/data-table";
import { subscribers } from "@/data/subscribers";
import { Lock } from "lucide-react";

const LOCKED = true;

export default function Page() {
  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>OpenStatus Status Page</SectionTitle>
          <SectionDescription>
            Allow your users to subscribe to status page updates.
          </SectionDescription>
        </SectionHeader>
      </Section>
      <Section>
        {LOCKED ? (
          <BillingOverlayContainer>
            <DataTable
              columns={columns}
              data={[...subscribers, ...subscribers, ...subscribers]}
            />
            <BillingOverlay>
              <BillingOverlayButton>
                <Lock />
                Upgrade to Starter
              </BillingOverlayButton>
              <BillingOverlayDescription>
                Keep your users in the loop with status page updates.{" "}
                <Link href="#">Learn more</Link>.
              </BillingOverlayDescription>
            </BillingOverlay>
          </BillingOverlayContainer>
        ) : (
          <DataTable columns={columns} data={subscribers} />
        )}
      </Section>
    </SectionGroup>
  );
}
