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
  allowUnset = false,
  placeholder = "No change",
}: {
  components: { id: number; name: string }[];
  value: ComponentImpactValue[];
  onValueChange: (value: ComponentImpactValue[]) => void;
  /** Components without an entry show the placeholder instead of defaulting to operational. */
  allowUnset?: boolean;
  placeholder?: string;
}) {
  function impactFor(id: number): PageComponentImpact | undefined {
    const found = value.find((v) => v.pageComponentId === id)?.impact;
    if (found) return found;
    return allowUnset ? undefined : "operational";
  }

  function setImpact(id: number, impact: PageComponentImpact) {
    const rest = value.filter((v) => v.pageComponentId !== id);
    onValueChange([...rest, { pageComponentId: id, impact }]);
  }

  if (components.length === 0) return null;

  return (
    <div className="grid gap-2">
      {components.map((component) => {
        const impact = impactFor(component.id);
        return (
          <div
            key={component.id}
            className="flex items-center justify-between gap-2"
          >
            <span className="truncate text-sm">{component.name}</span>
            <Select
              value={impact}
              onValueChange={(next) =>
                setImpact(component.id, next as PageComponentImpact)
              }
            >
              <SelectTrigger
                size="sm"
                className={cn(
                  impact ? impactConfig[impact].color : "text-muted-foreground",
                  "w-[180px] font-mono",
                )}
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {pageComponentImpact.map((option) => (
                  <SelectItem
                    key={option}
                    value={option}
                    className={cn(impactConfig[option].color, "font-mono")}
                  >
                    {impactConfig[option].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}
