"use client";

import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import { Label } from "@openstatus/ui/components/ui/label";
import { cn } from "@openstatus/ui/lib/utils";
import { useId } from "react";

import { toComponentSections } from "@/data/page-components.client";

export type CheckboxTreeItem = {
  id: number;
  label: string;
  children?: { id: number; label: string }[];
};

/**
 * Build a CheckboxTree shape from a flat list of page components plus their
 * optional groups, in page order. Components with a `groupId` nest under the
 * matching group; ungrouped components render as top-level leaves. Group ids
 * may collide with component ids, so callers treat tree ids as opaque.
 */
export function toCheckboxTreeItems(
  components: {
    id: number;
    name: string;
    groupId?: number | null;
    order?: number | null;
    groupOrder?: number | null;
  }[],
  groups: { id: number; name: string }[] = [],
): CheckboxTreeItem[] {
  return toComponentSections(components, groups).flatMap((section) =>
    section.group
      ? [
          {
            id: section.group.id,
            label: section.group.name,
            children: section.items.map((c) => ({ id: c.id, label: c.name })),
          },
        ]
      : section.items.map((c) => ({ id: c.id, label: c.name })),
  );
}

export type CheckboxTreeProps = {
  items: CheckboxTreeItem[];
  value: number[];
  onValueChange: (value: number[]) => void;
  className?: string;
};

export function CheckboxTree({
  items,
  value,
  onValueChange,
  className,
}: CheckboxTreeProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {items.map((item) => {
        // A defined `children` array (even empty) marks this as a parent row,
        // so callers with synthetic "Select all"-style parents can't accidentally
        // fall through to the leaf branch and submit the parent's id.
        if (item.children !== undefined) {
          if (item.children.length === 0) return null;
          const childIds = item.children.map((c) => c.id);
          const allChecked = childIds.every((id) => value.includes(id));
          const someChecked = childIds.some((id) => value.includes(id));
          return (
            <div key={`group-${item.id}`} className="flex flex-col gap-2">
              <CheckboxTreeRow
                label={item.label}
                checked={
                  allChecked ? true : someChecked ? "indeterminate" : false
                }
                onCheckedChange={(checked) => {
                  if (checked) {
                    onValueChange([...new Set([...value, ...childIds])]);
                  } else {
                    onValueChange(value.filter((id) => !childIds.includes(id)));
                  }
                }}
              />
              {item.children.map((child) => (
                <CheckboxTreeRow
                  key={`component-${child.id}`}
                  className="pl-6"
                  label={child.label}
                  checked={value.includes(child.id)}
                  onCheckedChange={(checked) => {
                    if (checked) {
                      onValueChange([...value, child.id]);
                    } else {
                      onValueChange(value.filter((id) => id !== child.id));
                    }
                  }}
                />
              ))}
            </div>
          );
        }
        return (
          <CheckboxTreeRow
            key={`component-${item.id}`}
            label={item.label}
            checked={value.includes(item.id)}
            onCheckedChange={(checked) => {
              if (checked) {
                onValueChange([...value, item.id]);
              } else {
                onValueChange(value.filter((id) => id !== item.id));
              }
            }}
          />
        );
      })}
    </div>
  );
}

function CheckboxTreeRow({
  label,
  checked,
  onCheckedChange,
  className,
}: {
  label: string;
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
  className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onCheckedChange(c === true)}
      />
      <Label htmlFor={id}>{label}</Label>
    </div>
  );
}
