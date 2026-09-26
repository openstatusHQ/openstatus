"use client";

import { StatusUpdatesSection } from "@openstatus/ui/components/blocks/status-updates";
import { Button } from "@openstatus/ui/components/ui/button";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import { Input } from "@openstatus/ui/components/ui/input";
import { Label } from "@openstatus/ui/components/ui/label";
import { Separator } from "@openstatus/ui/components/ui/separator";
import { useId, useState } from "react";

import { demo } from "@/data/demo-data";

const groups = [...new Set(demo.components.map((c) => c.group))];

/** Email tab body of the "Get updates" popover, no backend. */
export function SubscribeEmailTab() {
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
            placeholder="subscribe@me.com"
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
            <div className="border-border bg-muted flex flex-col gap-2 rounded-md border p-2">
              {groups.map((group) => (
                <div key={group} className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Checkbox checked="indeterminate" />
                    <Label>{group}</Label>
                  </div>
                  {demo.components
                    .filter((c) => c.group === group)
                    .map((c) => (
                      <div
                        key={c.name}
                        className="flex items-center gap-2 pl-6"
                      >
                        <Checkbox defaultChecked={!c.external} />
                        <Label>{c.name}</Label>
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
