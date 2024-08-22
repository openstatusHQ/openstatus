"use client";

import { Check, ChevronsUpDown, Globe2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import type { Region } from "@openstatus/tinybird";
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

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { cn } from "@/lib/utils";

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
  const [selected, setSelected] = React.useState<Region[]>(selectedRegions);
  const router = useRouter();
  const pathname = usePathname();
  const updateSearchParams = useUpdateSearchParams();

  const allSelected = regions.every((r) => selected.includes(r));

  React.useEffect(() => {
    if (!allSelected) {
      const searchParams = updateSearchParams({ regions: selected.join(",") });
      router.replace(`${pathname}?${searchParams}`, { scroll: false });
    } else if (allSelected) {
      const searchParams = updateSearchParams({ regions: null });
      router.replace(`${pathname}?${searchParams}`, { scroll: false });
    }
  }, [allSelected, router, pathname, updateSearchParams, selected]);

  const regionsByContinent = regions.reduce(
    (prev, curr) => {
      const region = flyRegionsDict[curr];

      if (prev[region.continent]) {
        prev[region.continent].push(region);
      } else {
        prev[region.continent] = [region];
      }

      return prev;
    },
    {} as Record<Continent, RegionInfo[]>
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
          <span>
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
            {Object.entries(regionsByContinent).map(([key, regions]) => {
              return (
                <CommandGroup key={key} heading={key}>
                  {regions.map((region) => {
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
                              : prev.filter((r) => r !== code)
                          );
                        }}
                      >
                        <div
                          className={cn(
                            "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                            isSelected
                              ? "bg-primary text-primary-foreground"
                              : "opacity-50 [&_svg]:invisible"
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
