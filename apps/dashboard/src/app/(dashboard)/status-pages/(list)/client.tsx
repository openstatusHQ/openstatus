"use client";

import { Theme } from "@openstatus/icons";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { NoteButton } from "@/components/common/note";
import { NoteDismissible } from "@/components/common/note-dismissible";
import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { columns } from "@/components/data-table/status-pages/columns";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSkeleton } from "@/components/ui/data-table/data-table-skeleton";
import { useTRPC } from "@/lib/trpc/client";

export function Client() {
  const trpc = useTRPC();
  const { data: statusPages } = useQuery(trpc.page.list.queryOptions());

  if (!statusPages) return <DataTableSkeleton rows={3} />;

  return (
    <SectionGroup>
      <NoteDismissible cookieKey="note_status_pages_themes">
        <Theme />
        Create your own custom themes for your status pages.
        <NoteButton variant="default" asChild>
          <Link href="https://themes.openstatus.dev" target="_blank">
            Learn more
          </Link>
        </NoteButton>
      </NoteDismissible>
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
