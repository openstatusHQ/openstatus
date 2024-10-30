"use client";

import { Check, ChevronsUpDown, Globe2 } from "lucide-react";
import * as React from "react";

import { Button, type ButtonProps } from "@openstatus/ui/src/components/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@openstatus/ui/src/components/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/src/components/popover";
import {
  type Continent,
  type RegionInfo,
  flyRegionsDict,
} from "@openstatus/utils";

import { cn } from "@/lib/utils";
import { type Region, flyRegions } from "@openstatus/db/src/schema/constants";

interface SelectRegionProps extends Omit<ButtonProps, "onChange"> {
  allowedRegions: Region[];
  value?: Region[];
  onChange?: (value: Region[]) => void;
}

export function SelectRegion({
  value = [],
  onChange,
  allowedRegions,
  className,
  ...props
}: SelectRegionProps) {
  const regionsByContinent = flyRegions.reduce(
    (prev, curr) => {
      const region = flyRegionsDict[curr];

      const item = prev.find((r) => r.continent === region.continent);

      if (item) {
        item.data.push(region);
      } else {
        prev.push({
          continent: region.continent,
          data: [region],
        });
      }

      return prev;
    },
    [] as { continent: Continent; data: RegionInfo[] }[],
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="lg"
          variant="outline"
          className={cn("px-3 shadow-none", className)}
          {...props}
        >
          <Globe2 className="mr-2 h-4 w-4" />
          <span className="whitespace-nowrap">
            <code>{value.length}</code> Regions
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command>
          <CommandInput placeholder="Search regions..." />
          <CommandList className="max-h-64">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => onChange?.(value.length ? [] : allowedRegions)}
              >
                {value.length ? "Clear all" : "Select all"}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            {regionsByContinent.map(({ continent, data }) => {
              return (
                <CommandGroup key={continent} heading={continent}>
                  {data.map((region) => {
                    const { code, flag, location, continent } = region;
                    const isSelected = value.includes(code);
                    return (
                      <CommandItem
                        key={code}
                        value={code}
                        keywords={[code, location, continent]}
                        disabled={!allowedRegions.includes(code)}
                        onSelect={(checked) => {
                          const newValue = !value.includes(checked as Region)
                            ? [...value, code]
                            : value.filter((r) => r !== code);
                          onChange?.(newValue);
                        }}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible",
                          )}
                        >
                          <Check className={cn("h-4 w-4")} />
                        </div>
                        <div className="flex w-full justify-between">
                          <span>
                            {code}{" "}
                            <span className="truncate text-muted-foreground">
                              {location}
                            </span>
                          </span>
                          <span>{flag}</span>
                        </div>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
              );
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
