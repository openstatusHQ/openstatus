// TODO: move to `ping-response-analysis`

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";
import { RegionInfo } from "@/components/ping-response-analysis/region-info";
import { ResponseHeaderTable } from "@/components/ping-response-analysis/response-header-table";
import { ResponseTimingTable } from "@/components/ping-response-analysis/response-timing-table";
import { prepareGetByPeriod } from "@/lib/tb";
import type { Region } from "@openstatus/db/src/schema/constants";

interface ResponseDetailsProps {
  monitorId: string;
  url?: string | undefined;
  region?: Region;
  cronTimestamp?: number | undefined;
  type: "http" | "tcp";
}

export async function ResponseDetails({
  type,
  ...props
}: ResponseDetailsProps) {
  // FIXME: this has to be dynamic
  const details = await prepareGetByPeriod("30d", type).getData(props);

  if (!details.data || details.data.length === 0) return null;

  const response = details.data[0];

  // FIXME: return the proper infos regarding TCP - but there are non right now anyways
  if (response.type === "tcp") return null;

  const { timing, headers, message, statusCode } = response;

  const defaultValue = headers ? "headers" : timing ? "timing" : "message";

  return (
    <div className="grid gap-8">
      <RegionInfo
        check={{
          latency: response.latency || 0,
          region: response.region,
          status: response.statusCode || 0,
          timestamp: response.cronTimestamp || 0,
        }}
      />
      <Tabs defaultValue={defaultValue}>
        <TabsList>
          <TabsTrigger value="headers" disabled={!headers}>
            Headers
          </TabsTrigger>
          <TabsTrigger value="timing" disabled={!timing}>
            Timing
          </TabsTrigger>
          <TabsTrigger value="message" disabled={!message}>
            Message
          </TabsTrigger>
        </TabsList>
        <TabsContent value="headers">
          {headers ? (
            <ResponseHeaderTable headers={headers} status={statusCode || 0} />
          ) : null}
        </TabsContent>
        <TabsContent value="timing">
          {timing ? <ResponseTimingTable timing={timing} hideInfo /> : null}
        </TabsContent>
        <TabsContent value="message">
          {message ? (
            <div>
              <pre
                className="text-wrap rounded-md bg-muted p-4 text-sm"
                style={{ textWrap: "wrap" }}
              >
                {message}
              </pre>
              <p className="mt-4 text-center text-muted-foreground text-sm">
                Response Message
              </p>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
