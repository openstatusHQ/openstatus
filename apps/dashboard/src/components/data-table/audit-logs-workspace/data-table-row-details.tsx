"use client";

import type { RouterOutputs } from "@openstatus/api";

import {
  ChangesTable,
  buildAuditLogChangeRows,
} from "@/components/common/changes-table";
import { CopyRow } from "@/components/common/copy-row";

type AuditLog = RouterOutputs["auditLog"]["list"]["items"][number];

export function DataTableRowDetails({ row }: { row: AuditLog }) {
  const changes = buildAuditLogChangeRows(row);

  return (
    <div className="bg-muted/30 p-4">
      {changes.length ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="col-span-2 flex flex-col gap-2">
            <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Changes
            </div>
            <ChangesTable changes={changes} />
          </div>
          <div className="flex flex-col gap-2">
            <div className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
              Entry
            </div>
            <dl className="flex flex-col gap-1.5">
              <CopyRow label="Entity Type" value={row.entityType} />
              <CopyRow label="Entity ID" value={row.entityId} />
              <CopyRow label="Actor Type" value={row.actorType} />
              <CopyRow label="Actor ID" value={row.actorId} />
              {row.user?.name ? (
                <CopyRow label="User Name" value={row.user.name} />
              ) : null}
              {row.user?.email ? (
                <CopyRow label="User Email" value={row.user.email} />
              ) : null}
            </dl>
          </div>
        </div>
      ) : null}
    </div>
  );
}
