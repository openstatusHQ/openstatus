import { OSTinybird } from "@openstatus/tinybird";
import type { ResponseDetailsParams } from "@openstatus/tinybird";

import { RegionInfo } from "@/app/play/checker/[id]/_components/region-info";
import { ResponseHeaderTable } from "@/app/play/checker/[id]/_components/response-header-table";
import { ResponseTimingTable } from "@/app/play/checker/[id]/_components/response-timing-table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";
import { env } from "@/env";

const tb = new OSTinybird({ token: env.TINY_BIRD_API_KEY });

export async function ResponseDetails(props: ResponseDetailsParams) {
  const details = await tb.endpointResponseDetails("45d")(props);

  if (!details || details?.length === 0) return null;

  const response = details[0];

  const { timing, headers, message } = response;

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
      <Tabs defaultValue="headers">
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
          {headers ? <ResponseHeaderTable headers={headers} /> : null}
        </TabsContent>
        <TabsContent value="timing">
          {timing ? <ResponseTimingTable timing={timing} hideInfo /> : null}
        </TabsContent>
        <TabsContent value="message">
          {message ? (
            <div>
              <pre className="bg-muted rounded-md p-4 text-sm">{message}</pre>
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
