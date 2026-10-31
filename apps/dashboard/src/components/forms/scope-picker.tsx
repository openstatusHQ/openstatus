"use client";

import {
  type ScopeGroup,
  type ScopePreset,
  type SettableScope,
  scopeGroups,
  scopePresets,
} from "@openstatus/db/src/schema/api-keys/constants";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import {
  RadioGroup,
  RadioGroupItem,
} from "@openstatus/ui/components/ui/radio-group";
import { cn } from "@openstatus/ui/lib/utils";
import { useId, useState } from "react";

import {
  coveredBy,
  expandScopes,
  groupLabels,
  matchPreset,
} from "./scope-label";

export interface ScopePresetOption {
  id: ScopePreset;
  label: string;
  description: string;
}

interface ScopePickerProps {
  value: SettableScope[];
  onChange: (value: SettableScope[]) => void;
  presets: ScopePresetOption[];
  /** Scopes the requester holds; Custom only offers what they cover. Omitted = all. */
  allowed?: readonly SettableScope[];
  className?: string;
  "aria-labelledby"?: string;
}

const optionClassName =
  "hover:bg-muted/40 has-[[aria-checked=true]]:border-primary flex cursor-pointer items-start gap-3 rounded-md border p-3";

export function ScopePicker({
  value,
  onChange,
  presets,
  allowed,
  className,
  "aria-labelledby": labelledBy,
}: ScopePickerProps) {
  const [custom, setCustom] = useState(false);
  const matched = matchPreset(value);
  const selected =
    !custom && matched && presets.some((p) => p.id === matched)
      ? matched
      : "custom";
  const isAllowed = (scope: SettableScope) =>
    !allowed || coveredBy(allowed, scope);

  function select(next: string) {
    if (next === "custom") {
      setCustom(true);
      onChange(expandScopes(value));
      return;
    }
    setCustom(false);
    onChange([...scopePresets[next as ScopePreset]]);
  }

  function toggle(group: ScopeGroup, kind: "read" | "write", checked: boolean) {
    const read: SettableScope = `${group}:read`;
    const write: SettableScope = `${group}:write`;
    const rest = value.filter((s) => s !== read && s !== write);
    if (kind === "write")
      onChange(checked ? [...rest, write] : [...rest, read]);
    else onChange(checked ? [...rest, read] : rest);
  }

  return (
    <div className={cn("grid gap-3", className)}>
      <RadioGroup
        aria-labelledby={labelledBy}
        value={selected}
        onValueChange={select}
        className="gap-3"
      >
        {presets.map((preset) => (
          <label key={preset.id} className={optionClassName}>
            <RadioGroupItem value={preset.id} className="mt-1" />
            <div className="space-y-0.5">
              <div className="text-sm font-medium">{preset.label}</div>
              <div className="text-muted-foreground text-xs">
                {preset.description}
              </div>
            </div>
          </label>
        ))}
        <label className={optionClassName}>
          <RadioGroupItem value="custom" className="mt-1" />
          <div className="space-y-0.5">
            <div className="text-sm font-medium">Custom</div>
            <div className="text-muted-foreground text-xs">
              Pick read or write access per resource.
            </div>
          </div>
        </label>
      </RadioGroup>
      {selected === "custom" ? (
        <div className="grid grid-cols-[1fr_auto_auto] items-center gap-x-6 gap-y-2 rounded-md border p-3">
          <span className="text-muted-foreground text-xs">Scopes</span>
          <span className="text-muted-foreground text-xs">Read</span>
          <span className="text-muted-foreground text-xs">Write</span>
          {scopeGroups.map((group) => (
            <ScopeRow
              key={group}
              group={group}
              value={value}
              isAllowed={isAllowed}
              onToggle={toggle}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ScopeRow({
  group,
  value,
  isAllowed,
  onToggle,
}: {
  group: ScopeGroup;
  value: SettableScope[];
  isAllowed: (scope: SettableScope) => boolean;
  onToggle: (
    group: ScopeGroup,
    kind: "read" | "write",
    checked: boolean,
  ) => void;
}) {
  const id = useId();
  const write = value.includes(`${group}:write`);
  const read = write || value.includes(`${group}:read`);
  return (
    <>
      <label htmlFor={`${id}-read`} className="text-sm font-medium">
        {groupLabels[group]}
      </label>
      <Checkbox
        id={`${id}-read`}
        aria-label={`${groupLabels[group]} read`}
        checked={read}
        disabled={write || !isAllowed(`${group}:read`)}
        onCheckedChange={(checked) => onToggle(group, "read", checked === true)}
        className="justify-self-center"
      />
      <Checkbox
        id={`${id}-write`}
        aria-label={`${groupLabels[group]} write`}
        checked={write}
        disabled={!isAllowed(`${group}:write`)}
        onCheckedChange={(checked) =>
          onToggle(group, "write", checked === true)
        }
        className="justify-self-center"
      />
    </>
  );
}
