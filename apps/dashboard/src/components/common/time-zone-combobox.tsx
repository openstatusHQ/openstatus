"use client";

import { Check, Expand } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@openstatus/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { cn } from "@openstatus/ui/lib/utils";
import { timeZoneShortName } from "@openstatus/utils";
import { useMemo, useState } from "react";

import {
  timeZoneSearchKeywords,
  timeZoneSearchScore,
} from "@/components/forms/status-page/timezone-search";

/** `"Asia/Tokyo (GMT+9)"`, or the zone alone when it has no short name. */
export function timeZoneLabel(timeZone: string) {
  const name = timeZoneShortName(timeZone);
  return name === timeZone ? timeZone : `${timeZone} (${name})`;
}

/** Searchable IANA zone picker; other props go to the trigger button, so it can sit in `FormControl`. */
export function TimeZoneCombobox({
  value,
  onChange,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "value" | "onChange"> & {
  value: string;
  onChange: (timeZone: string) => void;
}) {
  const [open, setOpen] = useState(false);
  // built on first open, not on mount: the search keywords take ~100 ms
  const [opened, setOpened] = useState(false);
  if (open && !opened) setOpened(true);
  const zones = useMemo(
    () =>
      opened
        ? // some engines list UTC themselves, others do not
          [...new Set(["UTC", ...Intl.supportedValuesOf("timeZone")])].map(
            (zone) => ({
              zone,
              label: timeZoneLabel(zone),
              keywords: timeZoneSearchKeywords(zone),
            }),
          )
        : [],
    [opened],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
          {...props}
        >
          <span className="truncate">{timeZoneLabel(value)}</span>
          <Expand className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0">
        <Command filter={timeZoneSearchScore}>
          <CommandInput placeholder="Search time zone..." />
          <CommandList>
            <CommandEmpty>No time zone found.</CommandEmpty>
            <CommandGroup>
              {zones.map(({ zone, label, keywords }) => (
                <CommandItem
                  key={zone}
                  value={zone}
                  keywords={keywords}
                  onSelect={() => {
                    onChange(zone);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      zone === value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
