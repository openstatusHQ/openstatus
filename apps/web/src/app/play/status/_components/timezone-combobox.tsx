"use client";

import { Check, ChevronsUpDown } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { cn } from "@/lib/utils";

const currentTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
const supportedTimezones = Intl.supportedValuesOf("timeZone");

export function TimezoneCombobox({ defaultValue }: { defaultValue?: string }) {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const updateSearchParams = useUpdateSearchParams();

  const value = defaultValue?.toLowerCase();

  const timezones = supportedTimezones.map((timezone) => ({
    value: timezone.toLowerCase(),
    label: timezone,
  }));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[220px] justify-between"
        >
          <span className="truncate">
            {value
              ? timezones.find((timezone) => timezone.value === value)?.label
              : "Select timezone..."}
            {defaultValue?.toLowerCase() === currentTimezone?.toLowerCase() ? (
              <span className="ml-1 font-light text-muted-foreground text-xs">
                (default)
              </span>
            ) : null}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search timezone..." />
          <CommandList>
            <CommandEmpty>No timezone found.</CommandEmpty>
            <CommandGroup className="max-h-[300px] overflow-y-auto">
              {timezones.map((timezone) => (
                <CommandItem
                  key={timezone.value}
                  value={timezone.value}
                  onSelect={(currentValue) => {
                    setOpen(false);

                    // update search params
                    const searchParams = updateSearchParams({
                      timezone:
                        currentValue === value
                          ? null // remove search param and use default timezone
                          : timezones.find(
                              (timezone) => timezone.value === currentValue,
                            )?.label || null,
                    });

                    // refresh page with new search params
                    router.replace(`${pathname}?${searchParams}`);
                    router.refresh();
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === timezone.value ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {timezone.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
