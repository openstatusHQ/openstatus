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
import { ButtonReset } from "@/components/controls-search/button-reset";
import { CommandRegion } from "@/components/controls-search/command-region";
import { DropdownStatus } from "@/components/controls-search/dropdown-status";
import { DropdownTrigger } from "@/components/controls-search/dropdown-trigger";
import { PopoverDate } from "@/components/controls-search/popover-date";
import { columns } from "@/components/data-table/response-logs/columns";
import { Sheet } from "@/components/data-table/response-logs/data-table-sheet";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { DataTableSkeleton } from "@/components/ui/data-table/data-table-skeleton";
import { exampleLogs } from "@/data/response-logs";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import type { PaginationState } from "@tanstack/react-table";
import { Lock } from "lucide-react";
import { useParams } from "next/navigation";
import { useQueryStates } from "nuqs";
import { useCallback, useMemo } from "react";
import { searchParamsParsers } from "./search-params";

export function Client() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const [
    { regions, status, selected, trigger, from, to, pageIndex, pageSize },
    setSearchParams,
  ] = useQueryStates(searchParamsParsers);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
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
    [pageIndex, pageSize],
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
    [pageIndex, pageSize, setSearchParams],
  );

  if (!workspace || !monitor) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>
            {monitor.jobType === "http" ? (
              <a href={monitor.url} target="_blank" rel="noopener noreferrer">
                {monitor.url}
              </a>
            ) : (
              monitor.url
            )}
          </SectionDescription>
        </SectionHeader>
        <div className="flex flex-wrap items-center gap-2">
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
          <Link
            href="https://docs.openstatus.dev/monitoring/monitor-data-collected/"
            rel="noreferrer"
            target="_blank"
          >
            Learn more
          </Link>
          .
        </BillingOverlayDescription>
      </BillingOverlay>
    </BillingOverlayContainer>
  );
}
