import { columns } from "@/components/data-table/rum/columns";
import { DataTable } from "@/components/data-table/rum/data-table";
import type { responseRumPageQuery } from "@openstatus/tinybird/src/validation";
import type { z } from "zod";

export const DataTableWrapper = ({
  data,
}: {
  data: z.infer<typeof responseRumPageQuery>[];
}) => {
  return <DataTable columns={columns} data={data} />;
};
