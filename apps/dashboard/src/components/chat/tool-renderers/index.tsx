import type {
  AgentToolInput,
  AgentToolName,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";
import type { ReactNode } from "react";

import {
  type ChangeRow,
  ChangesTable,
} from "@/components/common/changes-table";

import { addStatusReportUpdateChanges } from "./add-status-report-update";
import { createMaintenanceChanges } from "./create-maintenance";
import { createStatusReportChanges } from "./create-status-report";
import { DetailsTable } from "./details-table";
import { getAuditLogChanges } from "./get-audit-log";
import { getMonitorDetails } from "./get-monitor";
import { getMonitorStatusTable } from "./get-monitor-status";
import { getMonitorSummaryDetails } from "./get-monitor-summary";
import { getResponseLogDetails } from "./get-response-log";
import { listAuditLogsTable } from "./list-audit-logs";
import { listMaintenancesTable } from "./list-maintenances";
import { listMonitorsTable } from "./list-monitors";
import { listNotificationsTable } from "./list-notifications";
import { listPageComponentsTable } from "./list-page-components";
import { listPrivateLocationsTable } from "./list-private-locations";
import { listResponseLogsTable } from "./list-response-logs";
import { listStatusPagesTable } from "./list-status-pages";
import { listStatusReportsTable } from "./list-status-reports";
import { resolveStatusReportChanges } from "./resolve-status-report";
import { ResultTable } from "./result-table";
import { searchDocsTable } from "./search-docs";
import { updateStatusReportChanges } from "./update-status-report";

/**
 * Per-tool renderer keyed by `AgentToolName` so each entry's input/output
 * carry the tool's concrete schema — schema drift becomes a type error here.
 * Tools without an entry fall back to the raw JSON disclosure.
 */
export type ToolRenderer<N extends AgentToolName> = {
  renderDraft?: (input: AgentToolInput<N>) => ChangeRow[];
  renderResult?: (params: {
    input: AgentToolInput<N>;
    output: AgentToolOutput<N>;
  }) => ReactNode;
  summary?: (output: AgentToolOutput<N>) => string | undefined;
};

/**
 * Required map (no `?`) so adding a tool to `agentTools` without a
 * renderer entry is a TS error here. Tools that don't need a custom
 * renderer can opt in with `{}` — explicit, not silent.
 */
export type ToolRendererRegistry = {
  [N in AgentToolName]: ToolRenderer<N>;
};

export const toolRenderers: ToolRendererRegistry = {
  // ── Read tools ───────────────────────────────────────────────
  list_status_pages: {
    renderResult: ({ output }) => (
      <ResultTable {...listStatusPagesTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  list_page_components: {
    renderResult: ({ output }) => (
      <ResultTable {...listPageComponentsTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  list_status_reports: {
    renderResult: ({ output }) => (
      <ResultTable {...listStatusReportsTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  list_maintenances: {
    renderResult: ({ output }) => (
      <ResultTable {...listMaintenancesTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },

  // ── Destructive tools ────────────────────────────────────────
  create_status_report: {
    renderDraft: (input) => createStatusReportChanges(input),
    renderResult: ({ input, output }) => (
      <ChangesTable
        changes={createStatusReportChanges(input, {
          id: output.statusReport.id,
          notified: output.notified,
          createdAt: output.statusReport.createdAt,
        })}
      />
    ),
    summary: (o) => `ID ${o.statusReport.id}`,
  },
  add_status_report_update: {
    renderDraft: (input) => addStatusReportUpdateChanges(input),
    renderResult: ({ input, output }) => (
      <ChangesTable
        changes={addStatusReportUpdateChanges(input, {
          statusReportUpdateId: output.statusReportUpdateId,
          notified: output.notified,
        })}
      />
    ),
    summary: (o) => `update #${o.statusReportUpdateId}`,
  },
  update_status_report: {
    renderDraft: (input) => updateStatusReportChanges(input),
    renderResult: ({ input }) => (
      <ChangesTable changes={updateStatusReportChanges(input)} />
    ),
    summary: (o) => `ID ${o.id}`,
  },
  resolve_status_report: {
    renderDraft: (input) => resolveStatusReportChanges(input),
    renderResult: ({ input, output }) => (
      <ChangesTable
        changes={resolveStatusReportChanges(input, {
          statusReportUpdateId: output.statusReportUpdateId,
          notified: output.notified,
        })}
      />
    ),
    summary: (o) => `resolved · update #${o.statusReportUpdateId}`,
  },
  create_maintenance: {
    renderDraft: (input) => createMaintenanceChanges(input),
    renderResult: ({ input, output }) => (
      <ChangesTable
        changes={createMaintenanceChanges(input, {
          id: output.id,
          notified: output.notified,
        })}
      />
    ),
    summary: (o) => `ID ${o.id}`,
  },
  list_monitors: {
    renderResult: ({ output }) => (
      <ResultTable {...listMonitorsTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  list_notifications: {
    renderResult: ({ output }) => (
      <ResultTable {...listNotificationsTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  list_private_locations: {
    renderResult: ({ output }) => (
      <ResultTable {...listPrivateLocationsTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  list_response_logs: {
    renderResult: ({ output }) => (
      <ResultTable {...listResponseLogsTable(output)} />
    ),
    summary: (o) =>
      `${o.logs.length} log${o.logs.length === 1 ? "" : "s"}${o.hasMore ? " (more available)" : ""}`,
  },
  get_monitor: {
    renderResult: ({ input, output }) => (
      <DetailsTable {...getMonitorDetails(input, output)} />
    ),
    summary: (o) => `ID ${o.id}`,
  },
  get_monitor_status: {
    renderResult: ({ output }) => (
      <ResultTable {...getMonitorStatusTable(output)} />
    ),
    summary: (o) =>
      `${o.regions.length} region${o.regions.length === 1 ? "" : "s"}`,
  },
  get_monitor_summary: {
    renderResult: ({ input, output }) => (
      <DetailsTable {...getMonitorSummaryDetails(input, output)} />
    ),
    summary: (o) =>
      `${o.totalSuccessful + o.totalDegraded + o.totalFailed} checks · p95 ${o.p95}ms`,
  },
  get_response_log: {
    renderResult: ({ input, output }) => (
      <DetailsTable {...getResponseLogDetails(input, output)} />
    ),
    summary: (o) => (o.id ? `log ${o.id}` : undefined),
  },
  list_audit_logs: {
    renderResult: ({ output }) => (
      <ResultTable {...listAuditLogsTable(output)} />
    ),
    summary: (o) => itemsCountSummary(o.items),
  },
  get_audit_log: {
    renderResult: ({ output }) => (
      <ChangesTable changes={getAuditLogChanges(output)} />
    ),
    summary: (o) => `${o.action} · #${o.id}`,
  },
  search_docs: {
    renderResult: ({ output }) => <ResultTable {...searchDocsTable(output)} />,
    summary: (o) => (o.error ? o.error : itemsCountSummary(o.results)),
  },
  // No renderResult — a full markdown page in the transcript is noise; the
  // summary line plus the model's cited answer is the UX.
  get_doc_page: {
    summary: (o) =>
      o.error ? o.error : `read ${o.url}${o.truncated ? " (truncated)" : ""}`,
  },
};

function itemsCountSummary(items: unknown[] | undefined): string | undefined {
  if (!items) return undefined;
  return `${items.length} result${items.length === 1 ? "" : "s"}`;
}

// String-keyed dispatch — these helpers own the `as never` cast that
// bridges runtime `string` to the registry's per-tool literal types.
// Safe because the registry is authored against the same `AgentToolName`
// union the server emits.

// Dedup so streaming doesn't re-warn for the same unknown tool on every render.
const warnedToolNames = new Set<string>();

function findRenderer(toolName: string) {
  const renderer = toolRenderers[toolName as AgentToolName];
  if (!renderer && !warnedToolNames.has(toolName)) {
    warnedToolNames.add(toolName);
    console.warn(
      `chat: no renderer for tool "${toolName}" — falling back to raw JSON. Add an entry to toolRenderers.`,
    );
  }
  return renderer;
}

export function renderToolDraft(
  toolName: string,
  input: unknown,
): ChangeRow[] | undefined {
  return findRenderer(toolName)?.renderDraft?.(input as never);
}

export function renderToolResult(
  toolName: string,
  input: unknown,
  output: unknown,
): ReactNode | undefined {
  if (output === undefined) return undefined;
  return findRenderer(toolName)?.renderResult?.({
    input: input as never,
    output: output as never,
  });
}

export function summarizeToolOutput(
  toolName: string,
  output: unknown,
): string | undefined {
  if (output === undefined) return undefined;
  return findRenderer(toolName)?.summary?.(output as never);
}
