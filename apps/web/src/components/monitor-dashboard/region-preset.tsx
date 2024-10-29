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
import { parseAsArrayOf, parseAsStringLiteral, useQueryState } from "nuqs";

interface RegionsPresetProps extends ButtonProps {
  regions: Region[];
  selectedRegions: Region[];
}

export function RegionsPreset({
  regions,
  selectedRegions,
  className,
  ...props
}: RegionsPresetProps) {
  // TODO: check with the RSC pages
  const [selected, setSelected] = useQueryState(
    "regions",
    parseAsArrayOf(parseAsStringLiteral(flyRegions))
      .withDefault(selectedRegions.filter((r) => regions?.includes(r)))
      .withOptions({
        shallow: false, // required for SSR to call the RSC
      }),
  );

  const allSelected = regions.every((r) => selected.includes(r));

  const regionsByContinent = regions
    .reduce(
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
    )
    .sort((a, b) => a.continent.localeCompare(b.continent));

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
            <code>{selected.length}</code> Regions
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0" align="start">
        <Command
        // FIXME: keywords not taken - it would be great to search for "Europe"
        // filter={(value, search, keywords) => {
        //   const extendValue = `${value} ${keywords?.join(" ") || ""}`;
        //   if (extendValue.includes(search)) return 1;
        //   return 0;
        // }}
        >
          <CommandInput placeholder="Search regions..." />
          <CommandList className="max-h-64">
            <CommandEmpty>No results found.</CommandEmpty>
            <CommandGroup>
              <CommandItem
                onSelect={() => setSelected(allSelected ? [] : regions)}
              >
                {allSelected ? "Clear all" : "Select all"}
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            {regionsByContinent.map(({ continent, data }) => {
              return (
                <CommandGroup key={continent} heading={continent}>
                  {data.map((region) => {
                    const { code, flag, location, continent } = region;
                    const isSelected = selected.includes(code);
                    return (
                      <CommandItem
                        key={code}
                        value={code}
                        keywords={[code, location, continent]}
                        onSelect={(checked) => {
                          setSelected((prev) =>
                            !prev.includes(checked as Region)
                              ? [...prev, code]
                              : prev.filter((r) => r !== code),
                          );
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
