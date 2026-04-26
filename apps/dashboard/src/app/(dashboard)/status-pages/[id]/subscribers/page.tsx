"use client";

import { Link } from "@/components/common/link";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayContainer,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";

import { Section } from "@/components/content/section";
import { columns } from "@/components/data-table/subscribers/columns";
import { SubscribersDataTableToolbar } from "@/components/data-table/subscribers/data-table-toolbar";
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { FormSheetSubscriber } from "@/components/forms/subscriber/sheet";
import { toCheckboxTreeItems } from "@/components/ui/checkbox-tree";
import { DataTable } from "@/components/ui/data-table/data-table";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Lock, Plus } from "lucide-react";
import { notFound, useParams } from "next/navigation";
import { useState } from "react";

type Subscriber = RouterOutputs["pageSubscriber"]["list"][number];

const EXAMPLES = [
  {
    id: 1,
    email: "max@openstatus.dev",
    createdAt: new Date(),
    pageId: 1,
    channelType: "email",
    source: "self_signup",
    name: null,
    acceptedAt: new Date(),
    unsubscribedAt: null,
    components: [],
    isEntirePage: true,
    webhookUrl: null,
    channelConfig: null,
  },
  {
    id: 2,
    email: "thibault@openstatus.dev",
    createdAt: new Date(),
    pageId: 1,
    channelType: "email",
    source: "self_signup",
    name: null,
    acceptedAt: new Date(),
    unsubscribedAt: null,
    components: [],
    isEntirePage: true,
    webhookUrl: null,
    channelConfig: null,
  },
] satisfies Subscriber[];

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const pageId = Number(id);
  if (!Number.isInteger(pageId) || pageId <= 0) notFound();
  const [openDialog, setOpenDialog] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const trpc = useTRPC();
  const { data: page } = useQuery(trpc.page.get.queryOptions({ id: pageId }));
  const { data: subscribers, refetch } = useQuery(
    trpc.pageSubscriber.list.queryOptions({ pageId }),
  );
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: components } = useQuery(
    trpc.pageComponent.list.queryOptions({ pageId }),
  );

  const createAction = useMutation(
    trpc.pageSubscriber.createSubscription.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );

  if (!workspace) return null;

  const isLimited = workspace.limits["status-subscribers"] === false;
  const items = toCheckboxTreeItems(
    components ?? [],
    page?.pageComponentGroups ?? [],
  );

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>{page?.title}</SectionTitle>
            <SectionDescription>List of all subscribers.</SectionDescription>
          </SectionHeader>
          {isLimited ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpenDialog(true)}
            >
              <Lock className="mr-1 size-3.5" /> Add subscriber
            </Button>
          ) : (
            <FormSheetSubscriber
              open={openAdd}
              onOpenChange={setOpenAdd}
              items={items}
              onSubmit={async (values) => {
                if (values.channelType === "email") {
                  await createAction.mutateAsync({
                    pageId,
                    channelType: "email",
                    email: values.email,
                    name: values.name || null,
                    componentIds: values.componentIds,
                  });
                } else {
                  await createAction.mutateAsync({
                    pageId,
                    channelType: "webhook",
                    webhookUrl: values.webhookUrl,
                    name: values.name || null,
                    headers: values.headers,
                    componentIds: values.componentIds,
                  });
                }
              }}
            >
              <Button variant="outline" size="sm">
                <Plus className="mr-1 size-3.5" /> Add subscriber
              </Button>
            </FormSheetSubscriber>
          )}
        </SectionHeaderRow>
      </Section>
      <Section>
        {isLimited ? (
          <BillingOverlayContainer>
            <DataTable
              columns={columns}
              toolbarComponent={SubscribersDataTableToolbar}
              data={[...EXAMPLES, ...EXAMPLES, ...EXAMPLES]}
            />
            <BillingOverlay>
              <BillingOverlayButton onClick={() => setOpenDialog(true)}>
                <Lock />
                Upgrade
              </BillingOverlayButton>
              <BillingOverlayDescription>
                Keep your users in the loop with status page updates.{" "}
                <Link
                  href="https://docs.openstatus.dev/reference/subscriber/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Learn more
                </Link>
                .
              </BillingOverlayDescription>
            </BillingOverlay>
            <UpgradeDialog
              open={openDialog}
              onOpenChange={setOpenDialog}
              limit="status-subscribers"
            />
          </BillingOverlayContainer>
        ) : subscribers?.length ? (
          <DataTable
            columns={columns}
            data={subscribers}
            toolbarComponent={SubscribersDataTableToolbar}
            defaultColumnFilters={[{ id: "status", value: ["active"] }]}
          />
        ) : (
          <EmptyStateContainer>
            <EmptyStateTitle>No subscribers</EmptyStateTitle>
            <EmptyStateDescription>
              Nobody has been subscribed to this status page.
            </EmptyStateDescription>
          </EmptyStateContainer>
        )}
      </Section>
    </SectionGroup>
  );
}
