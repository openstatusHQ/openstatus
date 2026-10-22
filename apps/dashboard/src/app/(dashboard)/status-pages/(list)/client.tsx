"use client";

import { StatusPage, Theme } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { NoteButton } from "@/components/common/note";
import { NoteDismissible } from "@/components/common/note-dismissible";
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
import { columns } from "@/components/data-table/status-pages/columns";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
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
      <Section>
        <SectionHeader>
          <SectionTitle>Status Pages</SectionTitle>
          <SectionDescription>
            Create and manage your status pages.
          </SectionDescription>
        </SectionHeader>
        <DataTable
          columns={columns}
          data={statusPages}
          paginationComponent={DataTablePaginationSimple}
          emptyState={
            <DataTableEmpty>
              <EmptyStateMedia>
                <StatusPage />
              </EmptyStateMedia>
              <EmptyStateTitle>No status pages yet</EmptyStateTitle>
              <EmptyStateDescription>
                A status page shows the health of your components to your users,
                with every report and maintenance posted on it.
              </EmptyStateDescription>
              <EmptyStateActions>
                <Button size="sm" asChild>
                  <Link href="/status-pages/create">Create status page</Link>
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <Link href="https://status.openstatus.dev" target="_blank">
                    See an example
                  </Link>
                </Button>
              </EmptyStateActions>
            </DataTableEmpty>
          }
        />
      </Section>
    </SectionGroup>
  );
}
