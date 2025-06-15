"use client";

import { Link } from "@/components/common/link";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayContainer,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import {
  EmptyStateDescription,
  EmptyStateContainer,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";

import { Section } from "@/components/content/section";
import { columns } from "@/components/data-table/subscribers/columns";
import { DataTable } from "@/components/ui/data-table/data-table";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useParams } from "next/navigation";

const LOCKED = true;
const EXAMPLES = [
  {
    id: 1,
    email: "max@openstatus.dev",
    createdAt: new Date(),
    updatedAt: null,
    pageId: 1,
    token: null,
    acceptedAt: new Date(),
    expiresAt: new Date(),
  },
  {
    id: 2,
    email: "thibault@openstatus.dev",
    createdAt: new Date(),
    updatedAt: null,
    pageId: 1,
    token: null,
    acceptedAt: new Date(),
    expiresAt: new Date(),
  },
];

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: page } = useQuery(
    trpc.page.get.queryOptions({ id: parseInt(id) })
  );
  const { data: subscribers } = useQuery(
    trpc.pageSubscriber.list.queryOptions({ pageId: parseInt(id) })
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{page?.title}</SectionTitle>
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
              data={[...EXAMPLES, ...EXAMPLES, ...EXAMPLES]}
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
        ) : subscribers?.length ? (
          <DataTable columns={columns} data={subscribers} />
        ) : (
          <EmptyStateContainer>
            <EmptyStateTitle>No subscribers</EmptyStateTitle>
            <EmptyStateDescription>
              No emails have been subscribed to this status page.
            </EmptyStateDescription>
          </EmptyStateContainer>
        )}
      </Section>
    </SectionGroup>
  );
}
