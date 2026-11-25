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

import {
  ComponentImpact,
  ComponentList,
  ComponentListActions,
  ComponentListItem,
  ComponentListName,
} from "@/components/content/component-list";

export type ComponentImpactValue = {
  pageComponentId: number;
  impact: PageComponentImpact;
};

export function ComponentImpactList({
  components,
  value,
  onValueChange,
  allowUnset = false,
  defaultImpact = "operational",
  placeholder = "No change",
}: {
  components: { id: number; name: string }[];
  value: ComponentImpactValue[];
  onValueChange: (value: ComponentImpactValue[]) => void;
  /** Components without an entry show the placeholder instead of defaulting to `defaultImpact`. */
  allowUnset?: boolean;
  /** Shown for components without an entry; the caller must apply the same fallback on submit. */
  defaultImpact?: PageComponentImpact;
  placeholder?: string;
}) {
  function impactFor(id: number): PageComponentImpact | undefined {
    const found = value.find((v) => v.pageComponentId === id)?.impact;
    if (found) return found;
    return allowUnset ? undefined : defaultImpact;
  }

  function setImpact(id: number, impact: PageComponentImpact) {
    const rest = value.filter((v) => v.pageComponentId !== id);
    onValueChange([...rest, { pageComponentId: id, impact }]);
  }

  if (components.length === 0) return null;

  return (
    <ComponentList>
      {components.map((component) => (
        <ComponentListItem key={component.id}>
          <ComponentListName>{component.name}</ComponentListName>
          <ComponentListActions>
            <Select
              value={impactFor(component.id)}
              onValueChange={(next) =>
                setImpact(component.id, next as PageComponentImpact)
              }
            >
              <SelectTrigger
                size="sm"
                aria-label={`${component.name} impact`}
                className="w-[180px] font-mono"
              >
                <SelectValue placeholder={placeholder} />
              </SelectTrigger>
              <SelectContent>
                {pageComponentImpact.map((option) => (
                  <SelectItem key={option} value={option}>
                    <ComponentImpact impact={option} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ComponentListActions>
        </ComponentListItem>
      ))}
    </ComponentList>
  );
}
