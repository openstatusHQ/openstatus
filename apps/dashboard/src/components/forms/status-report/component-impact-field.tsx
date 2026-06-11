"use client";

import {
  type PageComponentImpact,
  pageComponentImpact,
} from "@openstatus/db/src/schema/page_components/constants";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { cn } from "@openstatus/ui/lib/utils";

import { impactConfig } from "@/data/status-report-updates.client";

export type ComponentImpactValue = {
  pageComponentId: number;
  impact: PageComponentImpact;
};

export function ComponentImpactList({
  components,
  value,
  onValueChange,
}: {
  components: { id: number; name: string }[];
  value: ComponentImpactValue[];
  onValueChange: (value: ComponentImpactValue[]) => void;
}) {
  function impactFor(id: number): PageComponentImpact {
    return value.find((v) => v.pageComponentId === id)?.impact ?? "operational";
  }

  function setImpact(id: number, impact: PageComponentImpact) {
    const rest = value.filter((v) => v.pageComponentId !== id);
    onValueChange([...rest, { pageComponentId: id, impact }]);
  }

  if (components.length === 0) return null;

  return (
    <div className="grid gap-2">
      {components.map((component) => (
        <div
          key={component.id}
          className="flex items-center justify-between gap-2"
        >
          <span className="truncate text-sm">{component.name}</span>
          <Select
            value={impactFor(component.id)}
            onValueChange={(impact) =>
              setImpact(component.id, impact as PageComponentImpact)
            }
          >
            <SelectTrigger
              size="sm"
              className={cn(
                impactConfig[impactFor(component.id)].color,
                "w-[180px] font-mono",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pageComponentImpact.map((impact) => (
                <SelectItem
                  key={impact}
                  value={impact}
                  className={cn(impactConfig[impact].color, "font-mono")}
                >
                  {impactConfig[impact].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ))}
    </div>
  );
}
