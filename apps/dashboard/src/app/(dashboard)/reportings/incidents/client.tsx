"use client";

import { defaultIncidentSlaTargets } from "@openstatus/db/src/schema/incident_sla_policies/constants";
import { Lock } from "@openstatus/icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

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
import { columns as attainmentColumns } from "@/components/data-table/incident-sla-attainment/columns";
import { UpgradeDialog } from "@/components/dialogs/upgrade";
import { FormCardGroup } from "@/components/forms/form-card";
import { FormIncidentReporting } from "@/components/forms/incident-reporting/form";
import { DataTable } from "@/components/ui/data-table/data-table";
import { useTRPC } from "@/lib/trpc/client";

const EXAMPLE_MONTHS = Array.from({ length: 6 }, (_, i) => {
  const incidents = [3, 1, 4, 2, 0, 2][i] ?? 0;
  const missed = i === 2 ? 1 : 0;
  const count = {
    within: incidents - missed,
    missed,
    open: 0,
    total: incidents,
  };
  return {
    month: `2025-${String(12 - i).padStart(2, "0")}-01`,
    incidents,
    response: count,
    resolution: count,
    missedUpdates: missed * 2,
  };
});

export function Client() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [openDialog, setOpenDialog] = useState(false);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const { data: members } = useQuery(trpc.member.list.queryOptions());
  const { data: policy, isPending } = useQuery(
    trpc.incidentReporting.get.queryOptions(),
  );
  const { data: attainment } = useQuery({
    ...trpc.incidentReporting.attainment.queryOptions(),
    enabled: workspace?.limits["incident-sla"] === true,
  });
  const invalidate = () =>
    queryClient.invalidateQueries({
      queryKey: trpc.incidentReporting.pathKey(),
    });
  const upsert = useMutation(
    trpc.incidentReporting.upsert.mutationOptions({ onSuccess: invalidate }),
  );
  const remove = useMutation(
    trpc.incidentReporting.delete.mutationOptions({ onSuccess: invalidate }),
  );

  if (!workspace || !user || !members || isPending) return null;

  const role = members.find((m) => m.user.id === user.id)?.role;
  const canEdit = role === "owner" || role === "admin";
  const locked = workspace.limits["incident-sla"] !== true;

  return (
    <SectionGroup>
      <Section id="incident-reporting">
        <SectionHeader>
          <SectionTitle>Incident reporting</SectionTitle>
          <SectionDescription>
            One reporting for the workspace. It applies to every incident
            declared after it is saved.
          </SectionDescription>
        </SectionHeader>
        <FormCardGroup>
          <FormIncidentReporting
            // remount so the fields follow a save or a turn-off
            key={policy ? `${policy.id}-${policy.updatedAt.getTime()}` : "new"}
            defaultValues={
              policy ?? {
                targets: defaultIncidentSlaTargets,
                resolutionStop: "mitigated",
                responseMet: "acknowledged",
              }
            }
            saved={!!policy}
            locked={locked}
            readOnly={!canEdit}
            onSubmit={async (values) => {
              await upsert.mutateAsync(values);
            }}
            onDelete={async () => {
              await remove.mutateAsync();
            }}
            onUpgrade={() => setOpenDialog(true)}
          />
        </FormCardGroup>
        <UpgradeDialog
          open={openDialog}
          onOpenChange={setOpenDialog}
          limit="incident-sla"
        />
      </Section>
      <Section id="attainment">
        <SectionHeader>
          <SectionTitle>Monthly attainment</SectionTitle>
          <SectionDescription>
            Tracked incidents of the last twelve months, by the month their
            clock started (UTC). A target still running counts as open, not as
            met. Canceled incidents are left out.
          </SectionDescription>
        </SectionHeader>
        {locked ? (
          <BillingOverlayContainer>
            <DataTable columns={attainmentColumns} data={EXAMPLE_MONTHS} />
            <BillingOverlay>
              <BillingOverlayButton
                data-track="paywall_viewed"
                data-limit="incident-sla"
                onClick={() => setOpenDialog(true)}
              >
                <Lock />
                Upgrade
              </BillingOverlayButton>
              <BillingOverlayDescription>
                Show, month by month, that every incident was handled within its
                severity's targets.
              </BillingOverlayDescription>
            </BillingOverlay>
          </BillingOverlayContainer>
        ) : attainment ? (
          <DataTable
            columns={attainmentColumns}
            data={[...attainment.months].reverse()}
            defaultPagination={{ pageIndex: 0, pageSize: 12 }}
          />
        ) : null}
      </Section>
    </SectionGroup>
  );
}
