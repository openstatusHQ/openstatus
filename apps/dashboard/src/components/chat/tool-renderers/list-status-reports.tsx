import type { AgentToolOutput } from "@openstatus/services/agent-tools";
import { SirenIcon } from "lucide-react";

import { Badge } from "@openstatus/ui/components/ui/badge";

import { EntityCard } from "./entity-card";

type Output = AgentToolOutput<"list_status_reports">;

const STATUS_TONE: Record<string, string> = {
  investigating: "border-destructive/30 bg-destructive/10 text-destructive",
  identified: "border-warning/30 bg-warning/10 text-warning",
  monitoring: "border-info/30 bg-info/10 text-info",
  resolved: "border-success/30 bg-success/10 text-success",
};

export function ListStatusReportsResult({ output }: { output: Output }) {
  const items = output?.items ?? [];
  if (items.length === 0) {
    return (
      <div className="rounded-md border bg-background p-3 text-muted-foreground text-sm">
        No status reports.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {items.map((r) => (
        <EntityCard
          key={r.id}
          icon={SirenIcon}
          title={r.title}
          meta={
            <>
              <span>ID {r.id}</span>
              {r.pageId !== null ? (
                <>
                  <span className="mx-1.5">·</span>
                  <span>page #{r.pageId}</span>
                </>
              ) : null}
            </>
          }
          right={
            <Badge variant="outline" className={STATUS_TONE[r.status]}>
              {r.status}
            </Badge>
          }
        />
      ))}
    </div>
  );
}
