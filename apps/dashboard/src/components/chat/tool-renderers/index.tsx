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
import { listMaintenancesTable } from "./list-maintenances";
import { listStatusPagesTable } from "./list-status-pages";
import { listStatusReportsTable } from "./list-status-reports";
import { resolveStatusReportChanges } from "./resolve-status-report";
import { ResultTable } from "./result-table";
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

export type ToolRendererRegistry = {
  [N in AgentToolName]?: ToolRenderer<N>;
};

export const toolRenderers: ToolRendererRegistry = {
  // ── Read tools ───────────────────────────────────────────────
  list_status_pages: {
    renderResult: ({ output }) => (
      <ResultTable {...listStatusPagesTable(output)} />
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
};

function itemsCountSummary(items: unknown[] | undefined): string | undefined {
  if (!items) return undefined;
  return `${items.length} result${items.length === 1 ? "" : "s"}`;
}

// String-keyed dispatch — these helpers own the `as never` cast that
// bridges runtime `string` to the registry's per-tool literal types.
// Safe because the registry is authored against the same `AgentToolName`
// union the server emits.

function findRenderer(toolName: string) {
  return toolRenderers[toolName as AgentToolName];
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
