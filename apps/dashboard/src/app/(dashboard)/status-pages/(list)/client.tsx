"use client";

import { Note, NoteButton } from "@/components/common/note";
import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { columns } from "@/components/data-table/status-pages/columns";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Palette } from "lucide-react";
import Link from "next/link";

export function Client() {
  const trpc = useTRPC();
  const { data: statusPages } = useQuery(trpc.page.list.queryOptions());

  // TODO: add skeleton
  if (!statusPages) return null;

  return (
    <SectionGroup>
      <Note>
        <Palette />
        Create your own custom themes for your status pages.
        <NoteButton variant="default" asChild>
          <Link href="https://themes.openstatus.dev" target="_blank">
            Learn more
          </Link>
        </NoteButton>
      </Note>
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
