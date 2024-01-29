import type { ResponseDetailsParams } from "@openstatus/tinybird";

import { RegionInfo } from "@/app/play/checker/[id]/_components/region-info";
import { ResponseHeaderTable } from "@/app/play/checker/[id]/_components/response-header-table";
import { ResponseTimingTable } from "@/app/play/checker/[id]/_components/response-timing-table";
import { getResponseDetailsData } from "@/lib/tb";

export async function ResponseDetails(props: ResponseDetailsParams) {
  const details = await getResponseDetailsData(props);

  console.log(details);

  if (!details || details?.length === 0) return null;

  const response = details[0];

  return (
    <div className="grid gap-6">
      <RegionInfo
        check={{
          latency: response.latency || 0,
          region: response.region,
          status: response.statusCode || 0,
          time: response.cronTimestamp || 0,
        }}
      />
      {response.timing ? (
        <ResponseTimingTable timing={response.timing} hideInfo />
      ) : null}
      {response?.headers ? (
        <ResponseHeaderTable headers={response.headers} />
      ) : null}
    </div>
  );
}
