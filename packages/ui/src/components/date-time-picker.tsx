// CREDITS: https://gist.github.com/fernandops26/da681c4b12e52191803b4fcb040cdebb
"use client";

import { DateTime } from "luxon";
import * as React from "react";
import type { SelectSingleEventHandler } from "react-day-picker";

import { Calendar } from "../components/calendar";
import { Input } from "../components/input";
import { Label } from "../components/label";

interface DateTimePickerProps {
  date: Date;
  setDate: (date: Date) => void;
  className?: string;
}

export function DateTimePicker({
  date,
  setDate,
  className,
}: DateTimePickerProps) {
  const [selectedDateTime, setSelectedDateTime] = React.useState<DateTime>(
    DateTime.fromJSDate(date),
  );

  const handleSelect: SelectSingleEventHandler = (_day, selected) => {
    const selectedDay = DateTime.fromJSDate(selected);
    const modifiedDay = selectedDay.set({
      hour: selectedDateTime.hour,
      minute: selectedDateTime.minute,
    });

    setSelectedDateTime(modifiedDay);
    setDate(modifiedDay.toJSDate());
  };

  const handleTimeChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const { value } = e.target;
    const hours = Number.parseInt(value.split(":")[0] || "00", 10);
    const minutes = Number.parseInt(value.split(":")[1] || "00", 10);
    const modifiedDay = selectedDateTime.set({ hour: hours, minute: minutes });

    setSelectedDateTime(modifiedDay);
    setDate(modifiedDay.toJSDate());
  };

  return (
    <div className={className}>
      <Calendar
        mode="single"
        selected={selectedDateTime.toJSDate()}
        onSelect={handleSelect}
        initialFocus
      />
      <div className="px-4 pb-4 pt-0">
        <Label>Time</Label>
        {/* TODO: style it properly! */}
        <Input
          type="time"
          onChange={handleTimeChange}
          value={selectedDateTime.toFormat("HH:mm")}
        />
      </div>
      {!selectedDateTime && <p>Please pick a day.</p>}
    </div>
  );
}
