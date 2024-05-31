import { api } from "@/trpc/server";
import { DataTableWrapper } from "./data-table-wrapper";

const RouteTable = async ({ dsn }: { dsn: string }) => {
  const data = await api.tinybird.rumMetricsForApplicationPerPage.query({
    dsn: dsn,
    period: "24h",
  });
  if (!data) {
    return null;
  }
  console.log(data.length);
  return (
    <div className="">
      <DataTableWrapper data={data} />
    </div>
  );
};

export { RouteTable };
