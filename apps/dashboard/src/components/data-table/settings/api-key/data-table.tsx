import type { RouterOutputs } from "@openstatus/api";
import { ApiKey as ApiKeyIcon } from "@openstatus/icons";

import {
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { DataTable as DataTableBase } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";

import { columns } from "./columns";

type ApiKey = RouterOutputs["apiKey"]["list"][number];

export function DataTable({ apiKeys }: { apiKeys: ApiKey[] }) {
  return (
    <DataTableBase
      columns={columns}
      data={apiKeys}
      paginationComponent={DataTablePaginationSimple}
      emptyState={
        <DataTableEmpty>
          <EmptyStateMedia>
            <ApiKeyIcon />
          </EmptyStateMedia>
          <EmptyStateTitle>No API keys yet</EmptyStateTitle>
          <EmptyStateDescription>
            A key lets the CLI, CI/CD and your own scripts read and write
            workspace data via the API.
          </EmptyStateDescription>
        </DataTableEmpty>
      }
    />
  );
}
