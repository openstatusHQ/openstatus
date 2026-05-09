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
 * Per-tool client renderers. Map a tool name (matching the server's
 * `agentTools` registry in `@openstatus/services/agent-tools`) to one or
 * more of:
 *
 *   - `renderDraft(input)` — returns a `ChangeRow[]` rendered as a
 *     `ChangesTable` in the HITL confirm card while the tool is
 *     `input-available`.
 *   - `renderResult({ input, output })` — returns free-form React used
 *     for `output-available` results. Destructive tools render a
 *     `ChangesTable` from the same builder so result and draft views
 *     share a single source of truth.
 *   - `summary(output)` — optional one-line tail for the collapsible
 *     trigger ("1 result", "ID 4", etc.).
 *
 * Tools without an entry fall back to the raw JSON disclosure.
 */
export type ToolRenderer = {
  renderDraft?: (input: unknown) => ChangeRow[];
  renderResult?: (params: { input: unknown; output: unknown }) => ReactNode;
  summary?: (output: unknown) => string | undefined;
};

export const toolRenderers: Record<string, ToolRenderer> = {
  // ── Read tools ───────────────────────────────────────────────
  list_status_pages: {
    renderResult: ({ output }) => (
      <ListStatusPagesResult output={output as never} />
    ),
    summary: (o) => itemsCountSummary((o as { items?: unknown[] })?.items),
  },
  list_status_reports: {
    renderResult: ({ output }) => (
      <ListStatusReportsResult output={output as never} />
    ),
    summary: (o) => itemsCountSummary((o as { items?: unknown[] })?.items),
  },
  list_maintenances: {
    renderResult: ({ output }) => (
      <ListMaintenancesResult output={output as never} />
    ),
    summary: (o) => itemsCountSummary((o as { items?: unknown[] })?.items),
  },

  // ── Destructive tools ────────────────────────────────────────
  create_status_report: {
    renderDraft: (i) => createStatusReportChanges(i as never),
    renderResult: ({ input, output }) => {
      const o = output as {
        statusReport: { id: number; createdAt?: string | null };
        notified?: boolean;
      };
      return (
        <ChangesTable
          changes={createStatusReportChanges(input as never, {
            id: o.statusReport.id,
            notified: o.notified,
            createdAt: o.statusReport.createdAt,
          })}
        />
      );
    },
    summary: (o) => {
      const id = (o as { statusReport?: { id?: number } })?.statusReport?.id;
      return id !== undefined ? `ID ${id}` : undefined;
    },
  },
  add_status_report_update: {
    renderDraft: (i) => addStatusReportUpdateChanges(i as never),
    renderResult: ({ input, output }) => {
      const o = output as {
        statusReportUpdateId: number;
        notified?: boolean;
      };
      return (
        <ChangesTable
          changes={addStatusReportUpdateChanges(input as never, {
            statusReportUpdateId: o.statusReportUpdateId,
            notified: o.notified,
          })}
        />
      );
    },
    summary: (o) => {
      const id = (o as { statusReportUpdateId?: number })?.statusReportUpdateId;
      return id !== undefined ? `update #${id}` : undefined;
    },
  },
  update_status_report: {
    renderDraft: (i) => updateStatusReportChanges(i as never),
    renderResult: ({ input }) => (
      <ChangesTable changes={updateStatusReportChanges(input as never)} />
    ),
    summary: (o) => {
      const id = (o as { id?: number })?.id;
      return id !== undefined ? `ID ${id}` : undefined;
    },
  },
  resolve_status_report: {
    renderDraft: (i) => resolveStatusReportChanges(i as never),
    renderResult: ({ input, output }) => {
      const o = output as {
        statusReportUpdateId: number;
        notified?: boolean;
      };
      return (
        <ChangesTable
          changes={resolveStatusReportChanges(input as never, {
            statusReportUpdateId: o.statusReportUpdateId,
            notified: o.notified,
          })}
        />
      );
    },
    summary: (o) => {
      const id = (o as { statusReportUpdateId?: number })?.statusReportUpdateId;
      return id !== undefined ? `resolved · update #${id}` : "resolved";
    },
  },
  create_maintenance: {
    renderDraft: (i) => createMaintenanceChanges(i as never),
    renderResult: ({ input, output }) => {
      const o = output as { id: number; notified?: boolean };
      return (
        <ChangesTable
          changes={createMaintenanceChanges(input as never, {
            id: o.id,
            notified: o.notified,
          })}
        />
      );
    },
    summary: (o) => {
      const id = (o as { id?: number })?.id;
      return id !== undefined ? `ID ${id}` : undefined;
    },
  },
};

function itemsCountSummary(items: unknown[] | undefined): string | undefined {
  if (!items) return undefined;
  return `${items.length} result${items.length === 1 ? "" : "s"}`;
}
