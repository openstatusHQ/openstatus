"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { parseAsStringLiteral, parseAsArrayOf, useQueryState } from "nuqs";
import React from "react";
import { groupByContinent } from "@openstatus/utils";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { REGIONS } from "@/data/metrics.client";

export const parseRegions = (regions: (typeof REGIONS)[number][]) =>
  parseAsArrayOf(
    parseAsStringLiteral(REGIONS.filter((region) => regions.includes(region)))
  ).withDefault(regions as unknown as (typeof REGIONS)[number][]);

export function CommandRegion({
  regions,
}: {
  regions: (typeof REGIONS)[number][];
}) {
  const [selectedRegions, setSelectedRegions] = useQueryState(
    "regions",
    parseRegions(regions)
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {selectedRegions.length === regions.length
            ? "All Regions"
            : `${selectedRegions.length} Regions`}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[200px] p-0">
        <Command>
          <CommandInput placeholder="Search region..." />
          <CommandList>
            <CommandGroup forceMount>
              <CommandItem
                onSelect={() => {
                  const items = document.querySelectorAll(
                    '[data-slot="command-item"][data-disabled="false"]'
                  );
                  const codes: (typeof REGIONS)[number][] = [];

                  items.forEach((item) => {
                    const code = item.getAttribute("data-value");
                    if (code && code !== "select-all") {
                      codes.push(code as (typeof REGIONS)[number]);
                    }
                  });

                  if (codes.length === selectedRegions.length) {
                    setSelectedRegions([]);
                  } else {
                    setSelectedRegions(codes);
                  }
                }}
                value="select-all"
              >
                Toggle selection
              </CommandItem>
            </CommandGroup>
            <CommandSeparator alwaysRender />
            {Object.entries(groupByContinent).map(
              ([continent, continentRegions]) => (
                <CommandGroup key={continent} heading={continent}>
                  {continentRegions
                    .filter((region) => regions.includes(region.code))
                    .map((region) => (
                      <CommandItem
                        key={region.code}
                        value={region.code}
                        keywords={[
                          region.code,
                          region.location,
                          region.continent,
                          region.flag,
                        ]}
                        onSelect={() => {
                          setSelectedRegions((prev) =>
                            prev.includes(region.code)
                              ? prev.filter((r) => r !== region.code)
                              : [...prev, region.code]
                          );
                        }}
                      >
                        <span className="mr-1">{region.flag}</span>
                        {region.code}
                        <span className="ml-1 truncate text-muted-foreground text-xs">
                          {region.location}
                        </span>
                        <Check
                          className={cn(
                            "ml-auto",
                            selectedRegions.includes(region.code)
                              ? "opacity-100"
                              : "opacity-0"
                          )}
                        />
                      </CommandItem>
                    ))}
                </CommandGroup>
              )
            )}
            <CommandEmpty>No region found.</CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
