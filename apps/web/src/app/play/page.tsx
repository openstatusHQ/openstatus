import { getResponseList, Tinybird } from "@openstatus/tinybird";

import MOCK from "@/app/_mocks/response-list.json";
import { env } from "@/env.mjs";
import { columns } from "./components/columns";
import { DataTable } from "./components/data-table";
import { Tracker } from "./components/tracker";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

export default async function PlayPage() {
  // REMINDER: to be removed
  let data = MOCK;
  if (process.env.NODE_ENV !== "development") {
    const res = await getResponseList(tb)({});
    data = res.data;
  }

  const sliceData = data
    .slice() // needed to make the array immutable
    .reverse()
    .slice(0, 100);

  return (
    <div className="grid gap-6">
      <Tracker
        data={sliceData.map((item) => ({
          color: item.statusCode === 200 ? "up" : "down",
          tooltip: item.statusCode == 200 ? "Operational" : "Downtime",
        }))}
        tooltipKey="tooltip"
      />
      <DataTable columns={columns} data={data} />
    </div>
  );
}
