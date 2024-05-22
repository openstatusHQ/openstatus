// TODO: move to `ping-response-analysis`

import { OSTinybird } from "@openstatus/tinybird";
import type { ResponseDetailsParams } from "@openstatus/tinybird";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";
import { RegionInfo } from "@/components/ping-response-analysis/region-info";
import { ResponseHeaderTable } from "@/components/ping-response-analysis/response-header-table";
import { ResponseTimingTable } from "@/components/ping-response-analysis/response-timing-table";
import { env } from "@/env";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

export async function ResponseDetails(props: ResponseDetailsParams) {
  const details = await tb.endpointResponseDetails("45d")(props);

  if (!details || details?.length === 0) return null;

  const response = details[0];

  const { timing, headers, message, statusCode } = response;

  const defaultValue = headers ? "headers" : timing ? "timing" : "message";

  return (
    <div className="grid gap-8">
      <RegionInfo
        check={{
          latency: response.latency || 0,
          region: response.region,
          status: response.statusCode || 0,
          time: response.cronTimestamp || 0,
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
                className="bg-muted text-wrap rounded-md p-4 text-sm"
                // @ts-expect-error some issues with types
                style={{ textWrap: "wrap" }}
              >
                {message}
              </pre>
              <p className="text-muted-foreground mt-4 text-center text-sm">
                Response Message
              </p>
            </div>
          ) : null}
        </TabsContent>
      </Tabs>
    </div>
  );
}
