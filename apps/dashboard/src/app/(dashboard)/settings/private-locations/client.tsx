"use client";
import type { RouterOutputs } from "@openstatus/api";
import { ExternalLink, Lock, PrivateLocation } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";

import { Link } from "@/components/common/link";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayContainer,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import {
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { columns } from "@/components/data-table/private-locations/columns";
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { FormSheetPrivateLocationCreate } from "@/components/forms/private-location/sheet-create";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useTRPC } from "@/lib/trpc/client";

const EXAMPLES = [
  {
    id: 1,
    name: "Private Location 1",
    token: "my-secret-token",
    status: "active",
    metadata: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    workspaceId: 1,
    lastSeenAt: new Date("2025-10-08"),
    privateLocationToMonitors: [],
    monitors: [],
  },
  {
    id: 2,
    name: "Private Location 2",
    token: "my-secret-token",
    status: "error",
    metadata: null,
    createdAt: new Date("2025-01-01"),
    updatedAt: new Date("2025-01-01"),
    workspaceId: 1,
    lastSeenAt: new Date("2025-06-08"),
    privateLocationToMonitors: [],
    monitors: [],
  },
] satisfies RouterOutputs["privateLocation"]["list"];

export function Client() {
  const trpc = useTRPC();
  const [openDialog, setOpenDialog] = useState(false);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: privateLocations } = useQuery(
    trpc.privateLocation.list.queryOptions(),
  );
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());

  if (!privateLocations || !workspace) return null;

  return (
    <SectionGroup>
      <SectionHeader>
        <SectionTitle>Private Locations</SectionTitle>
        <SectionDescription>
          Create and manage your private locations.
        </SectionDescription>
      </SectionHeader>
      <Section>
        {workspace.limits["private-locations"] === false ? (
          <BillingOverlayContainer>
            <DataTable
              paginationComponent={DataTablePaginationSimple}
              columns={columns}
              data={[...EXAMPLES, ...EXAMPLES, ...EXAMPLES]}
            />
            <BillingOverlay>
              <BillingOverlayButton
                data-track="paywall_viewed"
                data-limit="private-locations"
                onClick={() => setOpenDialog(true)}
              >
                <Lock />
                Upgrade
              </BillingOverlayButton>
              <BillingOverlayDescription>
                Create private locations to monitor your internal services.{" "}
                <Link
                  href="https://www.openstatus.dev/docs/guides/how-to-create-private-location/"
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
              limit="private-locations"
            />
          </BillingOverlayContainer>
        ) : (
          <DataTable
            paginationComponent={DataTablePaginationSimple}
            columns={columns}
            data={privateLocations}
            emptyState={
              <DataTableEmpty>
                <EmptyStateMedia>
                  <PrivateLocation />
                </EmptyStateMedia>
                <EmptyStateTitle>No private locations</EmptyStateTitle>
                <EmptyStateDescription>
                  Run the checker inside your own network to monitor services
                  the public internet cannot reach. Create one, then start the
                  checker with its token.
                </EmptyStateDescription>
                <EmptyStateActions>
                  <FormSheetPrivateLocationCreate monitors={monitors ?? []}>
                    <Button size="sm">Create private location</Button>
                  </FormSheetPrivateLocationCreate>
                  <Button size="sm" variant="outline" asChild>
                    <NextLink
                      href="https://www.openstatus.dev/docs/guides/how-to-create-private-location/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink />
                      Read the setup guide
                    </NextLink>
                  </Button>
                </EmptyStateActions>
              </DataTableEmpty>
            }
          />
        )}
      </Section>
    </SectionGroup>
  );
}
