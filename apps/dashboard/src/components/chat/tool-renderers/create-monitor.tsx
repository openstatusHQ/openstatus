import type {
  AgentToolInput,
  AgentToolOutput,
} from "@openstatus/services/agent-tools";

import type { ChangeRow } from "@/components/common/changes-table";

type Input = AgentToolInput<"create_monitor">;
type Output = AgentToolOutput<"create_monitor">;

export function formatFirstCheck(check: Output["firstCheck"]): string {
  if (!check) return "—";
  if (check.state === "success") {
    return `${check.region} · ${check.status ?? "?"} · ${check.latency ?? "?"} ms`;
  }
  return `${check.region} · error${check.message ? `: ${check.message}` : ""}`;
}

export function createMonitorChanges(
  input: Input,
  applied?: Output,
): ChangeRow[] {
  const changes: ChangeRow[] = [];
  if (applied) changes.push({ field: "id", after: applied.monitor.id });
  changes.push(
    { field: "name", after: input.name },
    { field: "url", after: input.url },
    { field: "jobType", after: input.jobType },
  );
  if (input.jobType === "http") {
    changes.push({ field: "method", after: input.method ?? "GET" });
  }
  changes.push(
    {
      field: "periodicity",
      after:
        applied?.monitor.periodicity ?? input.periodicity ?? "plan default",
    },
    {
      field: "regions",
      after: applied?.monitor.regions ?? input.regions ?? "plan default",
    },
    { field: "active", after: input.active ?? true },
  );
  if (input.description) {
    changes.push({ field: "description", after: input.description });
  }
  if (input.assertions?.length) {
    changes.push({ field: "assertions", after: input.assertions });
  }
  if (input.timeout !== undefined) {
    changes.push({ field: "timeout", after: input.timeout });
  }
  if (input.degradedAfter !== undefined) {
    changes.push({ field: "degradedAfter", after: input.degradedAfter });
  }
  if (applied && input.jobType === "http") {
    changes.push({
      field: "firstCheck",
      after: formatFirstCheck(applied.firstCheck),
    });
  }
  return changes;
}
