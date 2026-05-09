import type { ChangeRow } from "@/components/common/changes-table";

type Input = {
  title?: string;
  message?: string;
  from?: string;
  to?: string;
  pageId?: number;
  pageComponentIds?: number[];
  notify?: boolean;
};

type Applied = {
  id: number;
  notified?: boolean;
};

export function createMaintenanceChanges(
  input: Input,
  applied?: Applied,
): ChangeRow[] {
  return [
    { field: "title", after: input.title },
    { field: "message", after: input.message },
    { field: "from", after: input.from },
    { field: "to", after: input.to },
    { field: "pageId", after: input.pageId },
    { field: "pageComponentIds", after: input.pageComponentIds },
    {
      field: "notify",
      after: applied?.notified !== undefined ? applied.notified : input.notify,
    },
  ];
}
