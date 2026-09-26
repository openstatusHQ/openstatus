"use client";

import {
  StatusUpdatesJson,
  StatusUpdatesRss,
  StatusUpdatesSlack,
} from "@openstatus/ui/components/blocks/status-updates";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";

import { demo } from "@/data/demo-data";

import { Cell, CellDescription, CellHeader, CellTitle } from "./cell";
import { SubscribeEmailTab } from "./subscribe-email";

const feed = `https://${demo.company.domain}/feed`;

/** The subscribe surface, mirroring the status-page "Get updates" popover. */
export function SubscriptionsDemo() {
  return (
    <Cell>
      <CellHeader>
        <CellTitle>Get updates</CellTitle>
        <CellDescription>
          {demo.subscribers.email.toLocaleString("en-US")} email subscribers
        </CellDescription>
      </CellHeader>
      <Tabs defaultValue="email">
        <TabsList className="w-full rounded-none border-b">
          <TabsTrigger value="email">Email</TabsTrigger>
          <TabsTrigger value="slack">Slack</TabsTrigger>
          <TabsTrigger value="rss">RSS</TabsTrigger>
          <TabsTrigger value="json">JSON</TabsTrigger>
        </TabsList>
        <TabsContent value="email" className="flex flex-col gap-2">
          <SubscribeEmailTab />
        </TabsContent>
        <TabsContent value="slack">
          <StatusUpdatesSlack rssUrl={`${feed}/rss`} />
        </TabsContent>
        <TabsContent value="rss">
          <StatusUpdatesRss rssUrl={`${feed}/rss`} atomUrl={`${feed}/atom`} />
        </TabsContent>
        <TabsContent value="json">
          <StatusUpdatesJson url={`${feed}/json`} />
        </TabsContent>
      </Tabs>
    </Cell>
  );
}
