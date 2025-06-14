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
import { maintenances } from "@/data/maintenances";
import { Plus } from "lucide-react";

export default function Page() {
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
            <FormSheetMaintenance>
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
