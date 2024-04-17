import type { Assertion } from "@openstatus/assertions";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";
import { ResponseAssertion } from "./response-assertion";
import { ResponseHeaderTable } from "./response-header-table";
import { ResponseTimingTable } from "./response-timing-table";
import type { Timing } from "./utils";

export async function ResponseDetailTabs({
  timing,
  headers,
  message,
  assertions,
}: {
  timing: Timing | null;
  headers: Record<string, string> | null;
  message?: string | null;
  assertions?: Assertion[] | null;
}) {
  const defaultValue = headers ? "headers" : timing ? "timing" : "message";
  return (
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
        <TabsTrigger
          value="assertions"
          disabled={!assertions || assertions.length === 0}
        >
          Assertions
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
            <pre
              className="bg-muted text-wrap rounded-md p-4 text-sm"
              // @ts-expect-error textWrap is not a valid prop even though it is
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
      <TabsContent value="assertions">
        {assertions ? <ResponseAssertion {...{ assertions }} /> : null}
      </TabsContent>
    </Tabs>
  );
}
