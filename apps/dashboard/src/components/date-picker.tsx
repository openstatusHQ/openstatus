"use client";

import { useState } from "react";
import { subDays, subHours } from "date-fns";
import { DateRange } from "react-day-picker";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";

const LOCKED = true;

// TODO: add variant="outline" on active button

export default function DatePicker() {
  const today = new Date();
  const yesterday = {
    from: subDays(today, 1),
    to: subDays(today, 1),
  };
  const lastHour = {
    from: subHours(today, 1),
    to: today,
  };
  const last6Hours = {
    from: subHours(today, 5),
    to: today,
  };
  const last7Days = {
    from: subDays(today, 6),
    to: today,
  };
  const last14Days = {
    from: subDays(today, 13),
    to: today,
  };
  const last30Days = {
    from: subDays(today, 29),
    to: today,
  };

  const [month, setMonth] = useState(today);
  const [date, setDate] = useState<DateRange | undefined>(last7Days);

  return (
    <div className="flex max-sm:flex-col">
      <div className="relative py-4 max-sm:order-1 max-sm:border-t sm:w-32">
        <div className="h-full sm:border-e">
          <div className="flex flex-col px-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setDate({
                  from: today,
                  to: today,
                });
                setMonth(today);
              }}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setDate(yesterday);
                setMonth(yesterday.to);
              }}
            >
              Yesterday
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setDate(lastHour);
                setMonth(lastHour.to);
              }}
            >
              Last hour
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setDate(last6Hours);
                setMonth(last6Hours.to);
              }}
            >
              Last 6 hours
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setDate(last7Days);
                setMonth(last7Days.to);
              }}
            >
              Last 7 days
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setDate(last14Days);
                setMonth(last14Days.to);
              }}
            >
              Last 14 days
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="w-full justify-start"
              onClick={() => {
                setDate(last30Days);
                setMonth(last30Days.to);
              }}
              disabled={LOCKED}
            >
              Last 30 days{" "}
              {LOCKED ? (
                <span className="truncate text-xs">(Upgrade)</span>
              ) : null}
            </Button>
          </div>
        </div>
      </div>
      <Calendar
        mode="range"
        selected={date}
        onSelect={(newDate) => {
          if (newDate) {
            setDate(newDate);
          }
        }}
        month={month}
        onMonthChange={setMonth}
        className="p-2"
        disabled={[
          { after: today }, // Dates before today
          LOCKED ? { before: last14Days.from } : { before: last30Days.from }, // Dates before last 14/30 days
        ]}
      />
    </div>
  );
}
