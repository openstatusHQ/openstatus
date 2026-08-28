"use client";

import type { DatePreset } from "@openstatus/ui/components/data-table-filters/types";
import { Button } from "@openstatus/ui/components/ui/button";
import { Calendar } from "@openstatus/ui/components/ui/calendar";
import { Input } from "@openstatus/ui/components/ui/input";
import { Kbd } from "@openstatus/ui/components/ui/kbd";
import { Label } from "@openstatus/ui/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { Separator } from "@openstatus/ui/components/ui/separator";
import { useDebounce } from "@openstatus/ui/hooks/use-debounce";
import { presets as defaultPresets } from "@openstatus/ui/lib/date-preset";
import { cn } from "@openstatus/ui/lib/utils";
import { endOfDay, format } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import * as React from "react";
import type { DateRange } from "react-day-picker";

interface DatePickerWithRangeProps extends React.HTMLAttributes<HTMLDivElement> {
  date: DateRange | undefined;
  setDate: (date: DateRange | undefined) => void;
  presets?: DatePreset[];
}

/** The presets span the selectable window - nothing outside them is queryable. */
function getBounds(presets: DatePreset[]) {
  const from = presets.map((preset) => preset.from.getTime());
  const to = presets.map((preset) => preset.to.getTime());
  return {
    min: from.length ? new Date(Math.min(...from)) : undefined,
    max: to.length ? new Date(Math.max(...to)) : undefined,
  };
}

function clampToBounds(date: Date | undefined, min?: Date, max?: Date) {
  if (!date) return undefined;
  if (min && date < min) return min;
  if (max && date > max) return max;
  return date;
}

export function DatePickerWithRange({
  className,
  date,
  setDate,
  presets = defaultPresets,
}: DatePickerWithRangeProps) {
  const [open, setOpen] = React.useState(false);
  const { min, max } = React.useMemo(() => getBounds(presets), [presets]);

  const onCalendarSelect = React.useCallback(
    (range: DateRange | undefined) => {
      if (!range) {
        setDate(undefined);
        return;
      }
      // A day in the calendar means that whole day, but react-day-picker
      // returns its midnight - without this the last day gets excluded.
      setDate({
        from: clampToBounds(range.from, min, max),
        to: clampToBounds(range.to ? endOfDay(range.to) : undefined, min, max),
      });
    },
    [setDate, min, max],
  );

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (!open) return;

      presets.map((preset) => {
        if (preset.shortcut === e.key) {
          setDate({ from: preset.from, to: preset.to });
        }
      });
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setDate, presets, open]);

  return (
    <div className={cn("grid gap-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            id="date"
            variant="outline"
            className={cn(
              "hover:bg-muted/50 max-w-full justify-start truncate text-left font-normal shadow-none",
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-4 w-4" />
            {date?.from ? (
              date.to ? (
                <span className="truncate">
                  {format(date.from, "LLL dd, y")} -{" "}
                  {format(date.to, "LLL dd, y")}
                </span>
              ) : (
                format(date.from, "LLL dd, y")
              )
            ) : (
              <span>Pick a date</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="flex flex-col justify-between sm:flex-row">
            <div className="hidden sm:block">
              <DatePresets
                onSelect={setDate}
                selected={date}
                presets={presets}
              />
            </div>
            <div className="block p-3 sm:hidden">
              <DatePresetsSelect
                onSelect={setDate}
                selected={date}
                presets={presets}
              />
            </div>
            <Separator orientation="vertical" className="h-auto w-px" />
            <Calendar
              // This repo pins react-day-picker 8, where the prop is still
              // `initialFocus` — `autoFocus` only lands in 10.
              initialFocus
              mode="range"
              defaultMonth={date?.from}
              selected={date}
              onSelect={onCalendarSelect}
              numberOfMonths={1}
              fromDate={min}
              toDate={max}
              disabled={[
                ...(min ? [{ before: min }] : []),
                ...(max ? [{ after: max }] : []),
              ]}
            />
          </div>
          <Separator />
          <CustomDateRange
            onSelect={setDate}
            selected={date}
            min={min}
            max={max}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DatePresets({
  selected,
  onSelect,
  presets,
}: {
  selected: DateRange | undefined;
  onSelect: (date: DateRange | undefined) => void;
  presets: DatePreset[];
}) {
  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-muted-foreground mx-3 text-xs uppercase">Date Range</p>
      <div className="grid gap-1">
        {presets.map(({ label, shortcut, from, to }) => {
          const isActive = selected?.from === from && selected?.to === to;
          return (
            <Button
              key={label}
              variant={isActive ? "outline" : "ghost"}
              onClick={() => onSelect({ from, to })}
              className={cn(
                "flex items-center justify-between gap-6",
                !isActive && "border border-transparent!",
              )}
            >
              <span className="mr-auto">{label}</span>
              <Kbd className="uppercase">{shortcut}</Kbd>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

function DatePresetsSelect({
  selected,
  onSelect,
  presets,
}: {
  selected: DateRange | undefined;
  onSelect: (date: DateRange | undefined) => void;
  presets: DatePreset[];
}) {
  function findPreset(from?: Date, to?: Date) {
    return presets.find((p) => p.from === from && p.to === to)?.shortcut;
  }
  const [value, setValue] = React.useState<string | undefined>(
    findPreset(selected?.from, selected?.to),
  );

  React.useEffect(() => {
    const preset = findPreset(selected?.from, selected?.to);
    if (preset === value) return;
    setValue(preset);
  }, [selected, presets]);

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        const preset = presets.find((p) => p.shortcut === v);
        if (preset) {
          onSelect({ from: preset.from, to: preset.to });
        }
      }}
    >
      <SelectTrigger>
        <SelectValue placeholder="Date Presets" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          <SelectLabel>Date Presets</SelectLabel>
          {presets.map(({ label, shortcut }) => {
            return (
              <SelectItem
                key={label}
                value={shortcut}
                className="flex items-center justify-between [&>span:last-child]:flex [&>span:last-child]:w-full [&>span:last-child]:justify-between"
              >
                <span>{label}</span>
                <Kbd className="ml-2 uppercase">{shortcut}</Kbd>
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}

function CustomDateRange({
  selected,
  onSelect,
  min,
  max,
}: {
  selected: DateRange | undefined;
  onSelect: (date: DateRange | undefined) => void;
  min?: Date;
  max?: Date;
}) {
  const [range, setRange] = React.useState<DateRange | undefined>(selected);
  const debouncedRange = useDebounce(range, 1000);

  const selectedFrom = selected?.from?.getTime();
  const selectedTo = selected?.to?.getTime();

  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return "";
    const utcDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return utcDate.toISOString().slice(0, 16);
  };

  /** Presets and the calendar write `selected` - adopt it as the new draft,
   * otherwise editing one endpoint submits the other one from a stale range. */
  React.useEffect(() => {
    setRange(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFrom, selectedTo]);

  React.useEffect(() => {
    if (
      debouncedRange?.from?.getTime() === selectedFrom &&
      debouncedRange?.to?.getTime() === selectedTo
    ) {
      return;
    }
    onSelect(debouncedRange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedRange]);

  /** The calendar disables anything outside the presets - typing must not
   * slip past the same window. */
  const isWithinBounds = (date: Date) =>
    !(min && date < min) && !(max && date > max);

  return (
    <div className="flex flex-col gap-2 p-3">
      <p className="text-muted-foreground text-xs uppercase">Custom Range</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="grid w-full gap-1.5">
          <Label htmlFor="from">Start</Label>
          <Input
            key={formatDateForInput(selected?.from)}
            type="datetime-local"
            id="from"
            name="from"
            min={min ? formatDateForInput(min) : undefined}
            max={max ? formatDateForInput(max) : undefined}
            defaultValue={formatDateForInput(selected?.from)}
            onChange={(e) => {
              const newDate = new Date(e.target.value);
              if (Number.isNaN(newDate.getTime())) return;
              if (!isWithinBounds(newDate)) return;
              setRange((prev) => ({ from: newDate, to: prev?.to }));
            }}
            disabled={!selected?.from}
          />
        </div>
        <div className="grid w-full gap-1.5">
          <Label htmlFor="to">End</Label>
          <Input
            key={formatDateForInput(selected?.to)}
            type="datetime-local"
            id="to"
            name="to"
            min={min ? formatDateForInput(min) : undefined}
            max={max ? formatDateForInput(max) : undefined}
            defaultValue={formatDateForInput(selected?.to)}
            onChange={(e) => {
              const newDate = new Date(e.target.value);
              if (Number.isNaN(newDate.getTime())) return;
              if (!isWithinBounds(newDate)) return;
              setRange((prev) => ({ from: prev?.from, to: newDate }));
            }}
            disabled={!selected?.to}
          />
        </div>
      </div>
    </div>
  );
}
