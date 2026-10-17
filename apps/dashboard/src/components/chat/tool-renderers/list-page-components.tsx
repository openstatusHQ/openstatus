import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import { EntityRef } from "@/components/common/entity-ref/entity-ref";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";
import { entityKinds } from "@/data/entity-refs.client";

import type { ResultTableData } from "./result-table";

type Output = AgentToolOutput<"list_page_components">;

export function listPageComponentsTable(
  output: Output,
): ResultTableData<"name" | "type" | "page" | "monitor" | "id"> {
  const items = output?.items ?? [];
  return {
    empty: "No page components.",
    columns: [
      { key: "name", header: "Name" },
      { key: "type", header: "Type" },
      { key: "page", header: "Page" },
      { key: "monitor", header: "Monitor" },
      { key: "id", header: "ID" },
    ],
    rows: items.map((c) => ({
      id: c.id,
      cells: {
        name: (
          <TableCellLink
            href={entityKinds.pageComponent.href(c)}
            value={c.name}
          />
        ),
        type: (
          <TableCellText
            value={c.type}
            className="text-muted-foreground font-mono"
          />
        ),
        page: <EntityRef kind="page" id={c.pageId} />,
        monitor:
          c.monitorId !== null ? (
            <EntityRef kind="monitor" id={c.monitorId} />
          ) : (
            <TableCellText value={null} empty="No monitor" />
          ),
        id: <TableCellNumber value={c.id} />,
      },
    })),
  };
}
