"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from "@/components/ui/separator";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { formatDateForInput } from "@/lib/formatter";
import { endOfDay } from "date-fns";

type DatePickerProps = {
  range: DateRange;
  onSelect: (range: DateRange) => void;
  presets: { id: string; label: string; values: DateRange }[];
};

export function DatePicker({ range, onSelect, presets }: DatePickerProps) {
  const [today] = useState(new Date());
  const disableBefore = presets[presets.length - 1]?.values?.from;

  return (
    <div>
      <div className="flex flex-row">
        <div className="relative py-4">
          <div className="h-full">
            <div className="flex flex-col px-1">
              <div className="font-medium text-muted-foreground text-xs px-3 py-1">
                Presets
              </div>
              {presets.map((preset) => (
                <Button
                  key={preset.id}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    onSelect(preset.values);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
        <Separator orientation="vertical" className="h-auto! w-px" />
        <div className="flex-1 flex items-center justify-center">
          <Calendar
            mode="range"
            selected={range}
            onSelect={(newDate) => {
              if (newDate) {
                onSelect({
                  ...newDate,
                  to: newDate.to ? endOfDay(newDate.to) : undefined,
                });
              }
            }}
            className="p-2"
            disabled={[
              { after: today }, // Dates before today
              { before: disableBefore ?? today }, // Dates before last action
            ]}
          />
        </div>
      </div>
      <Separator />
      <div className="flex flex-col gap-2 px-3 py-4">
        <p className="font-medium text-muted-foreground text-xs px-1">
          Custom Range
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <div className="grid w-full gap-1.5">
            <Label htmlFor="from" className="px-1">
              Start
            </Label>
            <Input
              type="datetime-local"
              id="from"
              name="from"
              min={formatDateForInput(disableBefore ?? today)}
              max={formatDateForInput(today)}
              value={range.from ? formatDateForInput(range.from) : ""}
              onChange={(e) => {
                const newDate = new Date(e.target.value);
                if (!Number.isNaN(newDate.getTime())) {
                  onSelect({ ...range, from: newDate });
                }
              }}
              disabled={!range.from}
            />
          </div>
          <div className="grid w-full gap-1.5">
            <Label htmlFor="to" className="px-1">
              End
            </Label>
            <Input
              type="datetime-local"
              id="to"
              name="to"
              min={formatDateForInput(range.from ?? today)}
              max={formatDateForInput(today)}
              value={range.to ? formatDateForInput(range.to) : ""}
              onChange={(e) => {
                const newDate = new Date(e.target.value);
                if (!Number.isNaN(newDate.getTime())) {
                  onSelect({ ...range, to: newDate });
                }
              }}
              disabled={!range.to}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
