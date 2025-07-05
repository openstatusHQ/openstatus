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
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { useParams } from "next/navigation";
import { DropdownPeriod } from "@/components/controls-search/dropdown-period";
import { CommandRegion } from "@/components/controls-search/command-region";
import { DropdownStatus } from "@/components/controls-search/dropdown-status";
import { ButtonReset } from "@/components/controls-search/button-reset";
import { searchParamsParsers } from "./search-params";
import { useQueryStates } from "nuqs";
import { columns } from "@/components/data-table/response-logs/columns";
import { DataTablePagination } from "@/components/ui/data-table/data-table-pagination";
import { Sheet } from "@/components/data-table/response-logs/data-table-sheet";
import type { RouterOutputs } from "@openstatus/api";
import { DropdownTrigger } from "@/components/controls-search/dropdown-trigger";
import { DataTableSkeleton } from "@/components/ui/data-table/data-table-skeleton";
import { flyRegions } from "@openstatus/db/src/schema/constants";

// TODO: TCP logs

type ResponseLog = RouterOutputs["tinybird"]["list"]["data"][number];

const exampleLogs: ResponseLog[] = Array.from({ length: 10 }).map((_, i) => ({
  id: i.toString(),
  type: "http",
  url: "https://api.openstatus.dev",
  method: "GET",
  statusCode: 200,
  requestStatus: "success" as const,
  latency: 150,
  timing: {
    dns: 10,
    connect: 20,
    tls: 30,
    ttfb: 40,
    transfer: 50,
  },
  assertions: [],
  region: flyRegions[i],
  error: false,
  timestamp: new Date().getTime(),
  headers: {
    "Cache-Control": "private, no-cache, no-store, max-age=0, must-revalidate",
    "Content-Type": "text/html; charset=utf-8",
    Date: "Sun, 28 Jan 2024 08:50:13 GMT",
    Server: "Vercel",
  },
  workspaceId: "1",
  monitorId: "1",
  cronTimestamp: new Date().getTime(),
  trigger: "cron" as const satisfies "cron" | "api",
}));

export function Client() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const [{ period, regions, status, selected, trigger }, setSearchParams] =
    useQueryStates(searchParamsParsers);
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) })
  );
  const enabled = workspace && workspace?.plan !== "free";
  const { data: _logs, isLoading } = useQuery({
    ...trpc.tinybird.list.queryOptions({ monitorId: id, period }),
    enabled,
  });
  const { data: _log } = useQuery({
    ...trpc.tinybird.get.queryOptions({ id: selected, monitorId: id }),
    enabled: !!selected && enabled,
  });

  if (!workspace || !monitor) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>{monitor.url}</SectionDescription>
        </SectionHeader>
        <div className="flex items-center flex-wrap gap-2">
          <DropdownPeriod />
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
            paginationComponent={DataTablePagination}
            defaultColumnVisibility={
              monitor.jobType === "tcp"
                ? { timing: false, statusCode: false }
                : {}
            }
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
            Upgrade to Pro
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
