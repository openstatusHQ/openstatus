// CREDITS: https://gist.github.com/fernandops26/da681c4b12e52191803b4fcb040cdebb
"use client";

import { Calendar as CalendarIcon } from "lucide-react";
import { DateTime } from "luxon";
import * as React from "react";
import type { SelectSingleEventHandler } from "react-day-picker";

import { cn } from "../lib/utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { Input } from "./input";
import { Label } from "./label";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";

interface DateTimePickerProps {
  date: Date;
  setDate: (date: Date) => void;
  className?: string;
}

export function DateTimePickerPopover({
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
    <Popover>
      <PopoverTrigger asChild className="z-10">
        <Button
          variant={"outline"}
          className={cn(
            "w-[280px] justify-start text-left font-normal",
            !date && "text-muted-foreground",
            className,
          )}
          suppressHydrationWarning // because timestamp is not same, server and client
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? (
            selectedDateTime.toFormat("DDD HH:mm")
          ) : (
            <span>Pick a date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
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
      </PopoverContent>
    </Popover>
  );
}
