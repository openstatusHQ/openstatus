"use client";

import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { statusPages } from "@/data/status-pages";
import { columns } from "@/components/data-table/status-pages/columns";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";

export default function Page() {
  return (
    <SectionGroup>
      <SectionHeader>
        <SectionTitle>Status Pages</SectionTitle>
        <SectionDescription>
          Create and manage your status pages.
        </SectionDescription>
        <DataTable
          columns={columns}
          data={statusPages}
          paginationComponent={DataTablePaginationSimple}
        />
      </SectionHeader>
    </SectionGroup>
  );
}
