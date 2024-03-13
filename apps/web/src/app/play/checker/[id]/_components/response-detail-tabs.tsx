import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/dashboard/tabs";
import type { Timing } from "../utils";
import { ResponseHeaderTable } from "./response-header-table";
import { ResponseTimingTable } from "./response-timing-table";

export async function ResponseDetailTabs({
  timing,
  headers,
  message,
}: {
  timing: Timing | null;
  headers: Record<string, string> | null;
  message?: string | null;
}) {
  return (
    <Tabs defaultValue="headers">
      <TabsList>
        <TabsTrigger value="headers">Headers</TabsTrigger>
        <TabsTrigger value="timing">Timing</TabsTrigger>
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
  );
}
