"use client";

import type { HealthCheckReport } from "../../../../../lib/mcp/health-check";
import { ResultTableStatic, ToolsTableView, VerdictBarStatic } from "../client";

export function Table({ data }: { data: HealthCheckReport }) {
  return (
    <div className="space-y-4">
      <VerdictBarStatic report={data} />
      <ResultTableStatic report={data} />
      {data.toolsList.tools && data.toolsList.tools.length > 0 && (
        <ToolsTableView
          tools={data.toolsList.tools}
          total={data.toolsList.toolCount}
          truncated={data.toolsList.truncated}
        />
      )}
    </div>
  );
}
