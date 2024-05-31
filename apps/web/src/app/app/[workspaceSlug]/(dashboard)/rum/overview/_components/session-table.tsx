import { api } from "@/trpc/server";
import { DataTableWrapper } from "./data-table-wrapper";
import { useSearchParams } from "next/navigation";
import { use } from "react";

const SessionTable = async ({ dsn, path }: { dsn: string; path: string }) => {
  const data = await api.tinybird.sessionRumMetricsForPath.query({
    dsn: dsn,
    period: "24h",
    path: path,
  });

  console.log(data);
  if (!data) {
    return null;
  }

  return (
    <div>
      <DataTableWrapper data={data} />
    </div>
  );
};

export { SessionTable };
