import { columns } from "@/components/data-table/session/columns";
import { DataTable } from "@/components/data-table/session/data-table";
import type { sessionRumPageQuery } from "@openstatus/tinybird/src/validation";
import type { z } from "zod";

export const DataTableWrapper = ({
  data,
}: {
  data: z.infer<typeof sessionRumPageQuery>[];
}) => {
  return <DataTable columns={columns} data={data} />;
};
