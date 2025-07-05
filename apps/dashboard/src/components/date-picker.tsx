"use client";

import { useState } from "react";
import type { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

// TODO: add variant="outline" on active button

type DatePickerProps = {
  range: DateRange;
  onSelect: (range: DateRange) => void;
  actions: { id: string; label: string; values: DateRange }[];
};

export function DatePicker({ range, onSelect, actions }: DatePickerProps) {
  const [today] = useState(new Date());
  const disableBefore = actions[actions.length - 1]?.values?.from;

  return (
    <div className="flex max-sm:flex-col">
      <div className="relative py-4 max-sm:order-1 max-sm:border-t sm:w-32">
        <div className="h-full sm:border-e">
          <div className="flex flex-col px-1">
            <div className="font-medium text-muted-foreground text-xs px-3 py-1">
              Period
            </div>
            {actions.map((period) => (
              <Button
                key={period.id}
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  onSelect(period.values);
                }}
              >
                {period.label}
              </Button>
            ))}
          </div>
        </div>
      </div>
      <Calendar
        mode="range"
        selected={range}
        onSelect={(newDate) => {
          if (newDate) {
            onSelect(newDate);
          }
        }}
        className="p-2"
        disabled={[
          { after: today }, // Dates before today
          { before: disableBefore ?? today }, // Dates before last action
        ]}
      />
    </div>
  );
}
