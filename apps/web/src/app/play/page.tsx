import { getResponseList, Tinybird } from "@openstatus/tinybird";

import MOCK from "@/app/_mocks/response-list.json";
import { env } from "@/env.mjs";
import { Tracker } from "./components/tracker";

const tb = new Tinybird({ token: env.TINY_BIRD_API_KEY });

export default async function PlayPage() {
  // REMINDER: to be removed
  let data = MOCK;
  if (process.env.NODE_ENV !== "development") {
    const res = await getResponseList(tb)({ siteId: "openstatus" });
    data = res.data;
  }

  return (
    <div className="mx-auto">
      <Tracker
        data={data.slice(0, 100).map((item) => ({
          color: item.statusCode === 200 ? "up" : "down",
          tooltip: item.statusCode == 200 ? "Operational" : "Downtime",
        }))}
        tooltipKey="tooltip"
      />
    </div>
  );
}
