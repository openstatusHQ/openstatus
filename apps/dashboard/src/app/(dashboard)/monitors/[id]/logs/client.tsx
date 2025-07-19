"use client";

import { Link } from "@/components/common/link";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayContainer,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import {
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";

import { Section } from "@/components/content/section";
import { DataTable } from "@/components/ui/data-table/data-table";
import { useTRPC } from "@/lib/trpc/client";
import { PaginationState } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useParams } from "next/navigation";
import { CommandRegion } from "@/components/controls-search/command-region";
import { DropdownStatus } from "@/components/controls-search/dropdown-status";
import { ButtonReset } from "@/components/controls-search/button-reset";
import { searchParamsParsers } from "./search-params";
import { useQueryStates } from "nuqs";
import { columns } from "@/components/data-table/response-logs/columns";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { Sheet } from "@/components/data-table/response-logs/data-table-sheet";
import { DropdownTrigger } from "@/components/controls-search/dropdown-trigger";
import { DataTableSkeleton } from "@/components/ui/data-table/data-table-skeleton";
import { PopoverDate } from "@/components/controls-search/popover-date";
import { exampleLogs } from "@/data/response-logs";
import { useCallback, useMemo } from "react";

export function Client() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const [
    { regions, status, selected, trigger, from, to, pageIndex, pageSize },
    setSearchParams,
  ] = useQueryStates(searchParamsParsers);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) })
  );
  const enabled = workspace && workspace?.plan !== "free";
  const { data: _logs, isLoading } = useQuery({
    ...trpc.tinybird.list.queryOptions({ monitorId: id, from, to }),
    enabled,
  });
  const { data: _log } = useQuery({
    ...trpc.tinybird.get.queryOptions({ id: selected, monitorId: id }),
    enabled: !!selected && enabled,
  });

  const pagination = useMemo(
    () => ({ pageIndex, pageSize }),
    [pageIndex, pageSize]
  );

  const setPagination = useCallback(
    (p: PaginationState | ((old: PaginationState) => PaginationState)) => {
      const next = typeof p === "function" ? p({ pageIndex, pageSize }) : p;

      if (next.pageIndex !== pageIndex || next.pageSize !== pageSize) {
        setSearchParams({
          pageIndex: next.pageIndex,
          pageSize: next.pageSize,
        });
      }
    },
    [pageIndex, pageSize, setSearchParams]
  );

  if (!workspace || !monitor) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>{monitor.url}</SectionDescription>
        </SectionHeader>
        <div className="flex items-center flex-wrap gap-2">
          <PopoverDate />
          {monitor.jobType === "http" ? <DropdownStatus /> : null}
          <DropdownTrigger />
          <CommandRegion regions={monitor.regions} />
          <ButtonReset />
        </div>
      </Section>
      <Section>
        {isLoading ? (
          <DataTableSkeleton rows={10} />
        ) : !enabled ? (
          <BillingPlaceholder />
        ) : (
          <DataTable
            data={_logs?.data ?? []}
            columns={columns}
            onRowClick={(row) => {
              if (!row.original.id) return;
              setSearchParams({ selected: row.original.id });
            }}
            columnFilters={[
              { id: "trigger", value: trigger },
              { id: "requestStatus", value: status },
              { id: "region", value: regions },
            ].filter((i) => Boolean(i.value))}
            pagination={pagination}
            setPagination={setPagination}
            paginationComponent={DataTablePagination}
            defaultColumnVisibility={
              monitor.jobType === "tcp"
                ? { timing: false, statusCode: false }
                : {}
            }
            // NOTE: required to control the pagination
            autoResetPageIndex={false}
          />
        )}
        <Sheet
          data={_log?.data?.length ? _log.data[0] : null}
          onClose={() =>
            setTimeout(() => setSearchParams({ selected: null }), 300)
          }
        />
      </Section>
    </SectionGroup>
  );
}

function BillingPlaceholder() {
  return (
    <BillingOverlayContainer>
      <DataTable data={exampleLogs} columns={columns} />
      <BillingOverlay>
        <BillingOverlayButton asChild>
          <Link href="/settings/billing">
            <Lock />
            Upgrade
          </Link>
        </BillingOverlayButton>
        <BillingOverlayDescription>
          Access response headers, timing phases and more for each request.{" "}
          <Link href="#">Learn more</Link>.
        </BillingOverlayDescription>
      </BillingOverlay>
    </BillingOverlayContainer>
  );
}
