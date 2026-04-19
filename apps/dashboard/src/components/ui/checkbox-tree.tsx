"use client";

import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import { Label } from "@openstatus/ui/components/ui/label";
import { cn } from "@openstatus/ui/lib/utils";
import { useId } from "react";

export type CheckboxTreeItem = {
  id: number;
  label: string;
  children?: { id: number; label: string }[];
};

/**
 * Build a CheckboxTree shape from a flat list of page components plus their
 * optional groups. Components with a `groupId` nest under the matching group;
 * ungrouped components render as top-level leaves.
 */
export function toCheckboxTreeItems(
  components: { id: number; name: string; groupId?: number | null }[],
  groups: { id: number; name: string }[] = [],
): CheckboxTreeItem[] {
  const groupIds = new Set(groups.map((g) => g.id));
  const byGroup = new Map<number, { id: number; label: string }[]>();
  const ungrouped: CheckboxTreeItem[] = [];

  for (const c of components) {
    if (c.groupId != null && groupIds.has(c.groupId)) {
      const bucket = byGroup.get(c.groupId) ?? [];
      bucket.push({ id: c.id, label: c.name });
      byGroup.set(c.groupId, bucket);
    } else {
      ungrouped.push({ id: c.id, label: c.name });
    }
  }

  const groupItems: CheckboxTreeItem[] = groups
    .filter((g) => (byGroup.get(g.id)?.length ?? 0) > 0)
    .map((g) => ({
      id: g.id,
      label: g.name,
      children: byGroup.get(g.id),
    }));

  // Group the group IDs first (synthetic group ids may collide with component
  // ids in rare cases — callers should treat tree ids as opaque). Then leaves.
  return [...groupItems, ...ungrouped];
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
        if (item.children && item.children.length > 0) {
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
