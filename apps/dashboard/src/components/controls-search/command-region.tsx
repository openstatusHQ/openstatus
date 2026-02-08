"use client";

import { IconCloudProvider } from "@/components/common/icon-cloud-provider";
import { Link } from "@/components/common/link";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import type { REGIONS } from "@/data/metrics.client";
import { useTRPC } from "@/lib/trpc/client";
import { formatRegionCode, groupByContinent } from "@openstatus/regions";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@openstatus/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Check, Globe, Lock } from "lucide-react";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";

export function CommandRegion({
  regions,
  privateLocations,
}: {
  regions: (typeof REGIONS)[number][];
  privateLocations?: { id: number; name: string }[];
}) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const [selectedRegions, setSelectedRegions] = useQueryState(
    "regions",
    parseAsArrayOf(parseAsString).withDefault([
      ...regions,
      ...(privateLocations?.map((location) => location.id.toString()) ?? []),
    ]),
  );

  const limited = workspace?.plan === "free";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {selectedRegions.length === regions.length
            ? "All Regions"
            : `${selectedRegions.length} Regions`}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="relative w-[250px] overflow-hidden p-0"
      >
        <Command>
          <CommandInput placeholder="Search region..." disabled={limited} />
          <CommandList>
            <CommandGroup forceMount>
              <CommandItem
                onSelect={() => {
                  const items = document.querySelectorAll(
                    '[data-slot="command-item"][data-disabled="false"]',
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
                disabled={limited}
              >
                Toggle selection
              </CommandItem>
            </CommandGroup>
            <CommandSeparator alwaysRender />
            {Object.entries(groupByContinent).map(
              ([continent, continentRegions]) => {
                const allowedRegions = continentRegions.filter((region) =>
                  regions.includes(region.code),
                );

                if (allowedRegions.length === 0) {
                  return null;
                }
                return (
                  <CommandGroup key={continent} heading={continent}>
                    {allowedRegions.map((region) => (
                      <CommandItem
                        disabled={limited}
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
                              : [...prev, region.code],
                          );
                        }}
                      >
                        <span>{region.flag}</span>
                        <IconCloudProvider
                          provider={region.provider}
                          className="size-3"
                        />
                        <span className="font-mono">
                          {formatRegionCode(region.code)}
                        </span>
                        <span className="truncate text-muted-foreground text-xs">
                          {region.location}
                        </span>
                        <Check
                          className={cn(
                            "ml-auto",
                            selectedRegions.includes(region.code)
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                );
              },
            )}
            {privateLocations && privateLocations.length > 0 ? (
              <CommandGroup heading="Private Locations">
                {privateLocations.map((location) => (
                  <CommandItem
                    key={location.id}
                    keywords={[location.name]}
                    value={location.id.toString()}
                    onSelect={() => {
                      setSelectedRegions((prev) =>
                        prev.includes(location.id.toString())
                          ? prev.filter((r) => r !== location.id.toString())
                          : [...prev, location.id.toString()],
                      );
                    }}
                  >
                    <Globe className="size-3" />
                    <span className="truncate font-mono">{location.name}</span>
                    <Check
                      className={cn(
                        "ml-auto",
                        selectedRegions.includes(location.id.toString())
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}
            <CommandEmpty>No region found.</CommandEmpty>
          </CommandList>
        </Command>
        {limited ? (
          <BillingOverlay className="to-70%">
            <BillingOverlayButton asChild>
              <Link href="/settings/billing">
                <Lock />
                Upgrade
              </Link>
            </BillingOverlayButton>
            <BillingOverlayDescription>
              Filter by region is only available on paid plans.
            </BillingOverlayDescription>
          </BillingOverlay>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
