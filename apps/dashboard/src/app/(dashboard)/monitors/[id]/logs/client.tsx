"use client";

// REMINDER: React Compiler is not compatible with Tanstack Table v8
// https://github.com/TanStack/table/issues/5567
"use no memo";

import type { RouterOutputs } from "@openstatus/api";
import { Lock } from "@openstatus/icons";
import { DataTableFilterAICommand } from "@openstatus/ui/components/data-table-filters/data-table-filter-command-ai/index";
import { DataTableInfinite } from "@openstatus/ui/components/data-table-filters/data-table-infinite";
import { useDataTable } from "@openstatus/ui/components/data-table-filters/data-table-provider";
import { defineFilters } from "@openstatus/ui/lib/data-table-filters/filters/index";
import { useMemoryAdapter } from "@openstatus/ui/lib/data-table-filters/store/adapters/memory/index";
import { useNuqsAdapter } from "@openstatus/ui/lib/data-table-filters/store/adapters/nuqs/index";
import { useFilterState } from "@openstatus/ui/lib/data-table-filters/store/hooks/index";
import { DataTableStoreProvider } from "@openstatus/ui/lib/data-table-filters/store/provider/DataTableStoreProvider";
import {
  getDefaultColumnVisibility,
  resolveColumns,
} from "@openstatus/ui/lib/data-table-filters/table-schema/index";
import {
  keepPreviousData,
  useInfiniteQuery,
  useQuery,
} from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useMemo } from "react";

import { Link } from "@/components/common/link";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayContainer,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import { Sheet } from "@/components/data-table/response-logs/data-table-sheet";
import { exampleLogs } from "@/data/response-logs";
import { useTRPC } from "@/lib/trpc/client";

import {
  createLogsTable,
  RETENTION_DAYS,
  type ResponseLog,
} from "./table-schema";

const TABLE_ID = "response-logs";
const PAGE_SIZE = 50;
const MAX_WINDOW_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

type Monitor = RouterOutputs["monitor"]["get"];

/** The shape the generated filter schema keeps in the URL. */
type LogsFilterState = {
  requestStatus?: string[];
  timestamp?: Date[];
  statusCode?: number[];
  latency?: number[];
  region?: string[];
  trigger?: string[];
};

export function Client() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) }),
  );

  if (!workspace || !monitor) return null;

  // No `SectionGroup` here: it centres content in a `max-w-4xl` column, and the
  // table renders its own filter sidebar + toolbar shell that needs the full
  // width of the content area. The box is pinned to the space left below the
  // app header and the monitor tabs so the document never scrolls: the filter
  // sidebar and the table body each own their scroll instead.
  return (
    <div className="relative flex h-[calc(100svh-var(--spacing-app-header)-var(--spacing-app-tabs))] w-full flex-col overflow-hidden">
      {workspace.plan === "free" ? (
        <BillingPlaceholder />
      ) : (
        <LogsTable monitor={monitor} />
      )}
    </div>
  );
}

function LogsTable({ monitor }: { monitor: Monitor }) {
  const { schema, columns, filterFields, filterSchema } = useMemo(
    () =>
      createLogsTable({
        regions: monitor.regions,
        privateLocations: monitor.privateLocations ?? [],
        jobType: monitor.jobType,
      }),
    [monitor.regions, monitor.privateLocations, monitor.jobType],
  );

  const adapter = useNuqsAdapter(filterSchema.definition, { id: TABLE_ID });

  return (
    <DataTableStoreProvider adapter={adapter}>
      <LogsTableInner
        monitor={monitor}
        columns={columns}
        filterFields={filterFields}
        schema={schema}
        filterSchema={filterSchema}
      />
    </DataTableStoreProvider>
  );
}

function LogsTableInner({
  monitor,
  columns,
  filterFields,
  schema,
  filterSchema,
}: {
  monitor: Monitor;
  columns: ReturnType<typeof createLogsTable>["columns"];
  filterFields: ReturnType<typeof createLogsTable>["filterFields"];
  schema: ReturnType<typeof createLogsTable>["schema"];
  filterSchema: ReturnType<typeof createLogsTable>["filterSchema"];
}) {
  const trpc = useTRPC();
  const state = useFilterState<LogsFilterState>();
  const [selected, setSelected] = useQueryState("selected", parseAsString);

  // The table re-runs every filter over the fetched rows, so the range sent to
  // the pipes has to be the one `filterFn` will apply — a single date means
  // that whole day there, not "everything since".
  const filterDefs = useMemo(() => defineFilters(schema.definition), [schema]);

  const filters = useMemo(() => {
    const range = filterDefs
      .plan({ timestamp: state.timestamp })
      .find((op) => op.op === "dateRange");
    const from = range?.from;
    const to = range?.to;
    // The facet and list pipes only reach back `RETENTION_DAYS`, so a wider
    // range would silently truncate instead of returning what the picker shows.
    const floor = (to ?? new Date()).getTime() - MAX_WINDOW_MS;

    return {
      monitorId: monitor.id,
      from: from ? new Date(Math.max(from.getTime(), floor)) : undefined,
      to,
      regions: state.region?.length ? state.region : undefined,
      status: state.requestStatus?.length
        ? (state.requestStatus as ("success" | "error" | "degraded")[])
        : undefined,
      trigger: state.trigger?.length
        ? (state.trigger as ("cron" | "api")[])
        : undefined,
      statusCodes: state.statusCode?.length ? state.statusCode : undefined,
      latencyMin: state.latency?.[0],
      latencyMax: state.latency?.[1],
    };
  }, [state, monitor.id, filterDefs]);

  const { data, isFetching, isLoading, hasNextPage, fetchNextPage, refetch } =
    useInfiniteQuery(
      trpc.tinybird.listInfinite.infiniteQueryOptions(
        { ...filters, limit: PAGE_SIZE },
        {
          getNextPageParam: (page) => page.nextCursor ?? undefined,
          getPreviousPageParam: (page) => page.prevCursor ?? undefined,
        },
      ),
    );

  // Hold the previous counts while the next request is in flight. Without it
  // every filter change empties `facets`, and the checkbox filters — which
  // derive their option list from it — collapse to their declared set and
  // rebuild a moment later. `isPending` is then only true on the first load,
  // which is the one time there is nothing to hold on to.
  const { data: facets, isPending: isFacetsPending } = useQuery({
    ...trpc.tinybird.listFacets.queryOptions(filters),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });

  const rows = useMemo(
    () => data?.pages.flatMap((page) => page.data) ?? [],
    [data],
  );

  // `.hidden()` columns from the schema, plus the one that carries no value for
  // the non-HTTP checkers. The status code column is dropped from the schema
  // itself, so it needs no entry here.
  const columnVisibility = useMemo(
    () => ({
      ...getDefaultColumnVisibility(schema.definition),
      // gRPC carries HTTP's phase timings.
      ...(monitor.jobType === "http" || monitor.jobType === "grpc"
        ? {}
        : { timing: false }),
    }),
    [schema, monitor.jobType],
  );

  // A checkbox filter looks its count up by the option's own value, and
  // `col.presets.httpStatus()` options are numbers. The facet pipes return
  // every value as a string, so numeric columns need the key coerced back.
  const numericColumns = useMemo(
    () =>
      new Set(
        resolveColumns(schema.definition)
          .filter((column) => column.kind === "number")
          .map((column) => column.key),
      ),
    [schema],
  );

  const getFacetedUniqueValues = useCallback(
    (_table: unknown, columnId: string) => {
      const map = new Map<string | number, number>();
      const toKey = numericColumns.has(columnId) ? Number : String;
      for (const row of facets?.facets[columnId]?.rows ?? []) {
        map.set(toKey(row.value), row.total);
      }
      return map;
    },
    [facets, numericColumns],
  );

  const getFacetedMinMaxValues = useCallback(
    (_table: unknown, columnId: string): [number, number] | undefined => {
      if (columnId !== "latency") return undefined;
      const latency = facets?.facets.latency;
      if (latency?.min === undefined || latency.max === undefined) {
        return undefined;
      }
      return [latency.min, latency.max];
    },
    [facets],
  );

  return (
    <>
      <DataTableInfinite
        columns={columns}
        data={rows}
        filterFields={filterFields}
        defaultColumnVisibility={columnVisibility}
        getRowId={(row: ResponseLog, index: number) => row.id ?? String(index)}
        defaultRowSelection={selected ? { [selected]: true } : {}}
        getFacetedUniqueValues={
          getFacetedUniqueValues as React.ComponentProps<
            typeof DataTableInfinite<ResponseLog, unknown>
          >["getFacetedUniqueValues"]
        }
        getFacetedMinMaxValues={
          getFacetedMinMaxValues as React.ComponentProps<
            typeof DataTableInfinite<ResponseLog, unknown>
          >["getFacetedMinMaxValues"]
        }
        totalRows={facets?.totalRowCount}
        filterRows={facets?.filterRowCount}
        totalRowsFetched={rows.length}
        isFetching={isFetching}
        isLoading={isLoading}
        isFacetsLoading={isFacetsPending}
        hasNextPage={hasNextPage}
        fetchNextPage={fetchNextPage}
        refetch={refetch}
        tableId={TABLE_ID}
        commandSlot={
          <DataTableFilterAICommand
            schema={filterSchema.definition}
            tableSchema={schema.definition}
            api="/api/ai-filters"
            tableId={TABLE_ID}
          />
        }
        sheetSlot={<LogsSheet monitor={monitor} onSelect={setSelected} />}
        footerSlot={
          <p className="text-muted-foreground text-xs text-balance">
            Build your own data-table filters with{" "}
            <Link href="https://logs.run?ref=openstatus">logs.run</Link>
          </p>
        }
      />
    </>
  );
}

/**
 * Bridges the table's row selection to the existing response-log sheet, and
 * mirrors it into `selected` so a row survives a reload. Rows written before
 * the checker stamped an id have no detail to fetch, so they resolve to null.
 */
function LogsSheet({
  monitor,
  onSelect,
}: {
  monitor: Monitor;
  onSelect: (value: string | null) => void;
}) {
  const trpc = useTRPC();
  const { table, rowSelection } = useDataTable<ResponseLog, unknown>();
  const selectedRow = table.getSelectedRowModel().rows[0];
  // The row model only holds fetched rows, so a bookmarked log from a later
  // page would resolve to null and wipe `selected` from the URL. The selection
  // record carries the id whether or not its row has been fetched.
  const selectedId = selectedRow
    ? (selectedRow.original.id ?? null)
    : (Object.keys(rowSelection).find((key) => rowSelection[key]) ?? null);

  useEffect(() => {
    onSelect(selectedId);
  }, [selectedId, onSelect]);

  const { data: log } = useQuery({
    ...trpc.tinybird.get.queryOptions({
      id: selectedId ?? "",
      monitorId: String(monitor.id),
    }),
    enabled: Boolean(selectedId),
  });

  return (
    <Sheet
      data={log?.data?.length ? log.data[0] : null}
      privateLocations={monitor.privateLocations ?? []}
      onClose={() => {
        table.resetRowSelection();
        setTimeout(() => onSelect(null), 300);
      }}
    />
  );
}

function BillingPlaceholder() {
  const { columns, filterFields, filterSchema, schema } = useMemo(
    () =>
      createLogsTable({
        regions: Array.from(new Set(exampleLogs.map((log) => log.region))),
        privateLocations: [],
      }),
    [],
  );
  const adapter = useMemoryAdapter(filterSchema.definition, {
    id: `${TABLE_ID}-example`,
  });

  return (
    <BillingOverlayContainer className="flex min-h-0 flex-1 flex-col">
      <DataTableStoreProvider adapter={adapter}>
        <DataTableInfinite
          columns={columns}
          data={exampleLogs as unknown as ResponseLog[]}
          filterFields={filterFields}
          totalRowsFetched={exampleLogs.length}
          hasNextPage={false}
          fetchNextPage={() => Promise.resolve()}
          refetch={() => {}}
          isFetching={false}
          isLoading={false}
          tableId={`${TABLE_ID}-example`}
          commandSlot={
            <DataTableFilterAICommand
              schema={filterSchema.definition}
              tableSchema={schema.definition}
              api="/api/ai-filters"
              tableId={`${TABLE_ID}-example`}
            />
          }
        />
      </DataTableStoreProvider>
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
            href="https://www.openstatus.dev/docs/concept/latency-vs-response-time/"
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
