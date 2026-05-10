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
import { ListMaintenancesResult } from "./list-maintenances";
import { ListStatusPagesResult } from "./list-status-pages";
import { ListStatusReportsResult } from "./list-status-reports";
import { resolveStatusReportChanges } from "./resolve-status-report";
import { updateStatusReportChanges } from "./update-status-report";

/**
 * Per-tool client renderer keyed on the registry's literal tool names.
 * `N extends AgentToolName` lets each entry carry the concrete
 * `AgentToolInput<N>` / `AgentToolOutput<N>` for that tool — the
 * compiler enforces that the renderer handles the schema's actual
 * shape. A renamed or removed field upstream becomes a type error here
 * instead of a silent runtime miss.
 *
 *   - `renderDraft(input)` — `ChangeRow[]` rendered as a `ChangesTable`
 *     in the HITL confirm card while the tool is `input-available`.
 *   - `renderResult({ input, output })` — free-form React for
 *     `output-available` results. Destructive tools render a
 *     `ChangesTable` from the same builder so result + draft views
 *     share a single source of truth.
 *   - `summary(output)` — optional one-line tail for the collapsible
 *     trigger ("1 result", "ID 4", etc.).
 *
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
    renderResult: ({ output }) => <ListStatusPagesResult output={output} />,
    summary: (o) => itemsCountSummary(o.items),
  },
  list_status_reports: {
    renderResult: ({ output }) => <ListStatusReportsResult output={output} />,
    summary: (o) => itemsCountSummary(o.items),
  },
  list_maintenances: {
    renderResult: ({ output }) => <ListMaintenancesResult output={output} />,
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
