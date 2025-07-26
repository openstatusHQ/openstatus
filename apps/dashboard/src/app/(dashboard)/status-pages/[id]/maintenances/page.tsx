"use client";

import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionHeaderRow,
  SectionTitle,
} from "@/components/content/section";
import { columns } from "@/components/data-table/maintenances/columns";
import { FormSheetMaintenance } from "@/components/forms/maintenance/sheet";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/ui/data-table/data-table";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useParams } from "next/navigation";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const trpc = useTRPC();
  const { data: statusPage } = useQuery(
    trpc.page.get.queryOptions({ id: Number.parseInt(id) }),
  );
  const { data: maintenances, refetch } = useQuery(
    trpc.maintenance.list.queryOptions({
      pageId: Number.parseInt(id),
    }),
  );
  const createStatusPageMutation = useMutation(
    trpc.maintenance.new.mutationOptions({
      onSuccess: () => refetch(),
    }),
  );

  if (!statusPage || !maintenances) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeaderRow>
          <SectionHeader>
            <SectionTitle>Maintenances</SectionTitle>
            <SectionDescription>
              See our maintenances and scheduled downtimes.
            </SectionDescription>
          </SectionHeader>
          <div>
            <FormSheetMaintenance
              monitors={statusPage.monitors}
              onSubmit={async (values) => {
                await createStatusPageMutation.mutateAsync({
                  pageId: Number.parseInt(id),
                  title: values.title,
                  message: values.message,
                  startDate: values.startDate,
                  endDate: values.endDate,
                  monitors: values.monitors,
                });
              }}
            >
              <Button data-section="action" size="sm" variant="ghost">
                <Plus />
                Create Maintenance
              </Button>
            </FormSheetMaintenance>
          </div>
        </SectionHeaderRow>
        <DataTable columns={columns} data={maintenances} />
      </Section>
    </SectionGroup>
  );
}
