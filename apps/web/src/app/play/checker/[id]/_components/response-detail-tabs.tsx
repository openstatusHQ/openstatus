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
}: {
  timing: Timing;
  headers: Record<string, string>;
}) {
  return (
    <Tabs defaultValue="headers">
      <TabsList>
        <TabsTrigger value="headers">Headers</TabsTrigger>
        <TabsTrigger value="timing">Timing</TabsTrigger>
      </TabsList>
      <TabsContent value="headers">
        {headers ? <ResponseHeaderTable headers={headers} /> : null}
      </TabsContent>
      <TabsContent value="timing">
        {timing ? <ResponseTimingTable timing={timing} /> : null}
      </TabsContent>
    </Tabs>
  );
}
