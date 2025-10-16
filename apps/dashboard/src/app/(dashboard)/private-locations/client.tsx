"use client";
import { Link } from "@/components/common/link";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayContainer,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { columns } from "@/components/data-table/private-locations/columns";
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { DataTable } from "@/components/ui/data-table/data-table";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@openstatus/api";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useState } from "react";

const EXAMPLES = [
  {
    id: 1,
    name: "Private Location 1",
    token: "my-secret-token",
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
              columns={columns}
              data={[...EXAMPLES, ...EXAMPLES, ...EXAMPLES]}
            />
            <BillingOverlay>
              <BillingOverlayButton onClick={() => setOpenDialog(true)}>
                <Lock />
                Upgrade
              </BillingOverlayButton>
              <BillingOverlayDescription>
                Create private locations to monitor your internal services.{" "}
                <Link
                  href="https://docs.openstatus.dev/reference/private-location/"
                  rel="noreferrer"
                  target="_blank"
                >
                  Learn more
                </Link>
                .
              </BillingOverlayDescription>
            </BillingOverlay>
            <UpgradeDialog open={openDialog} onOpenChange={setOpenDialog} />
          </BillingOverlayContainer>
        ) : (
          <DataTable columns={columns} data={privateLocations} />
        )}
      </Section>
    </SectionGroup>
  );
}
