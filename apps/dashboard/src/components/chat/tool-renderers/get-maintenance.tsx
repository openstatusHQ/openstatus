import type { AgentToolOutput } from "@openstatus/services/agent-tools";

import {
  EntityRef,
  EntityRefList,
} from "@/components/common/entity-ref/entity-ref";
import { TableCellDate } from "@/components/data-table/table-cell-date";
import { TableCellLink } from "@/components/data-table/table-cell-link";
import { TableCellNumber } from "@/components/data-table/table-cell-number";
import { TableCellText } from "@/components/data-table/table-cell-text";
import { entityKinds } from "@/data/entity-refs.client";

import type { DetailsTableData } from "./details-table";

export function getMaintenanceDetails(
  output: AgentToolOutput<"get_maintenance">,
): DetailsTableData {
  return {
    sections: [
      {
        rows: [
          { label: "ID", value: <TableCellNumber value={output.id} /> },
          {
            label: "Title",
            value:
              output.pageId !== null ? (
                <TableCellLink
                  href={entityKinds.maintenance.href({
                    id: output.id,
                    pageId: output.pageId,
                  })}
                  value={output.title}
                />
              ) : (
                <TableCellText value={output.title} />
              ),
          },
          {
            label: "Page",
            value:
              output.pageId !== null ? (
                <EntityRef kind="page" id={output.pageId} />
              ) : (
                <TableCellText value={null} />
              ),
          },
          {
            label: "From",
            value: <TableCellDate value={new Date(output.from)} />,
          },
          { label: "To", value: <TableCellDate value={new Date(output.to)} /> },
          {
            label: "Components",
            value: output.pageComponentIds.length ? (
              <EntityRefList
                kind="pageComponent"
                refs={output.pageComponentIds}
              />
            ) : (
              <TableCellText value={null} empty="None" />
            ),
          },
        ],
      },
      {
        title: "Timeline",
        rows: output.updates.map((u) => ({
          label: `#${u.id}`,
          value: (
            <div className="flex flex-col gap-1">
              <TableCellDate value={new Date(u.date)} />
              <TableCellText value={u.message} />
            </div>
          ),
        })),
      },
    ],
  };
}
