import type { ChangeRow } from "@/components/common/changes-table";

type Input = {
  statusReportId?: number;
  status?: string;
  message?: string;
  date?: string;
  notify?: boolean;
};

type Applied = {
  statusReportUpdateId: number;
  notified?: boolean;
};

export function addStatusReportUpdateChanges(
  input: Input,
  applied?: Applied,
): ChangeRow[] {
  const changes: ChangeRow[] = [
    { field: "statusReportId", after: input.statusReportId },
    { field: "status", after: input.status },
    { field: "message", after: input.message },
    {
      field: "notify",
      after: applied?.notified !== undefined ? applied.notified : input.notify,
    },
  ];
  if (input.date) {
    changes.push({ field: "date", after: input.date });
  }
  return changes;
}
