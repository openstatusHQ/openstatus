"use client";

import { Input } from "@openstatus/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { useState } from "react";

const UNITS = [
  { value: "60", label: "minutes" },
  { value: "3600", label: "hours" },
  { value: "86400", label: "days" },
] as const;

type Unit = (typeof UNITS)[number]["value"];

function largestUnit(seconds: number): Unit {
  if (seconds > 0 && seconds % 86_400 === 0) return "86400";
  if (seconds > 0 && seconds % 3_600 === 0) return "3600";
  return "60";
}

/** A whole number of minutes, hours or days, emitted as seconds. */
export function HeartbeatDurationInput({
  value,
  onChange,
  disabled,
  id,
}: {
  value: number | undefined;
  onChange: (seconds: number | undefined) => void;
  disabled?: boolean;
  id?: string;
}) {
  const [unit, setUnit] = useState<Unit>(largestUnit(value ?? 0));
  const amount = value === undefined ? "" : String(value / Number(unit));

  return (
    <div className="flex gap-2">
      <Input
        id={id}
        type="number"
        min={1}
        step={1}
        disabled={disabled}
        value={amount}
        onChange={(event) => {
          const next = event.target.valueAsNumber;
          onChange(Number.isNaN(next) ? undefined : next * Number(unit));
        }}
      />
      <Select
        value={unit}
        disabled={disabled}
        onValueChange={(next) => {
          const nextUnit = UNITS.find((u) => u.value === next)?.value ?? "60";
          setUnit(nextUnit);
          if (value !== undefined) {
            onChange((value / Number(unit)) * Number(nextUnit));
          }
        }}
      >
        <SelectTrigger className="w-32">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {UNITS.map((u) => (
            <SelectItem key={u.value} value={u.value}>
              {u.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
