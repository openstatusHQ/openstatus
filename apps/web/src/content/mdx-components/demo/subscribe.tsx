"use client";

import {
  StatusUpdatesJson,
  StatusUpdatesRss,
  StatusUpdatesSection,
  StatusUpdatesSlack,
  StatusUpdatesSsh,
} from "@openstatus/ui/components/blocks/status-updates";
import { Button } from "@openstatus/ui/components/ui/button";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import { Input } from "@openstatus/ui/components/ui/input";
import { Label } from "@openstatus/ui/components/ui/label";
import { Separator } from "@openstatus/ui/components/ui/separator";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@openstatus/ui/components/ui/tabs";
import { useId, useState } from "react";

import { feedUrl, getGroups, sshCommand } from "@/data/demo-data";

/** The "Get updates" tabs as the status page renders them, no backend. */
export function SubscribeTabs() {
  return (
    <Tabs defaultValue="email">
      <TabsList className="w-full border-b">
        <TabsTrigger value="email">Email</TabsTrigger>
        <TabsTrigger value="slack">Slack</TabsTrigger>
        <TabsTrigger value="rss">RSS</TabsTrigger>
        <TabsTrigger value="json">JSON</TabsTrigger>
        <TabsTrigger value="ssh">SSH</TabsTrigger>
      </TabsList>
      <TabsContent value="email" className="flex flex-col gap-2">
        <SubscribeEmailTab />
      </TabsContent>
      <TabsContent value="slack">
        <StatusUpdatesSlack rssUrl={`${feedUrl}/rss`} />
      </TabsContent>
      <TabsContent value="rss">
        <StatusUpdatesRss
          rssUrl={`${feedUrl}/rss`}
          atomUrl={`${feedUrl}/atom`}
        />
      </TabsContent>
      <TabsContent value="json">
        <StatusUpdatesJson url={`${feedUrl}/json`} />
      </TabsContent>
      <TabsContent value="ssh">
        <StatusUpdatesSsh command={sshCommand} />
      </TabsContent>
    </Tabs>
  );
}

/** Monitors start checked, external services unchecked; the group mirrors its items. */
function groupChecked(items: readonly { name: string }[]) {
  const checked = items.filter((c) => !("external" in c)).length;
  if (checked === items.length) return true;
  return checked === 0 ? false : "indeterminate";
}

function SubscribeEmailTab() {
  const id = useId();
  const [components, setComponents] = useState(false);
  return (
    <>
      <StatusUpdatesSection
        description="Get email notifications whenever a report has been created or resolved"
        className="py-0 pt-2"
      >
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => e.preventDefault()}
        >
          <Input
            type="email"
            placeholder="bighead@hooli.com"
            aria-label="Email"
          />
          <div className="flex items-center gap-2">
            <Checkbox
              id={`${id}-components`}
              checked={components}
              onCheckedChange={(v) => setComponents(v === true)}
            />
            <Label htmlFor={`${id}-components`}>
              Subscribe to specific components
            </Label>
          </div>
          {components ? (
            <div className="border-border bg-muted flex flex-col gap-2 border p-2">
              {getGroups().map((group) => (
                <div key={group.name} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`${id}-${group.name}`}
                      defaultChecked={groupChecked(group.items)}
                    />
                    <Label htmlFor={`${id}-${group.name}`}>{group.name}</Label>
                  </div>
                  {group.items.map((c) => (
                    <div key={c.name} className="flex items-center gap-2 pl-6">
                      <Checkbox
                        id={`${id}-${c.name}`}
                        defaultChecked={!("external" in c)}
                      />
                      <Label htmlFor={`${id}-${c.name}`}>{c.name}</Label>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          ) : null}
        </form>
      </StatusUpdatesSection>
      <Separator />
      <div className="px-2 pb-2">
        <Button className="w-full" type="button">
          Subscribe
        </Button>
      </div>
    </>
  );
}
