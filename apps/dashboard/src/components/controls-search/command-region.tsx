"use client";

import { Link } from "@/components/common/link";
import {
  BillingOverlay,
  BillingOverlayButton,
  BillingOverlayDescription,
} from "@/components/content/billing-overlay";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { REGIONS } from "@/data/metrics.client";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { Fly, Koyeb, Railway } from "@openstatus/icons";
import { groupByContinent } from "@openstatus/utils";
import { useQuery } from "@tanstack/react-query";
import { Check, Globe, Lock } from "lucide-react";
import { parseAsArrayOf, parseAsStringLiteral, useQueryState } from "nuqs";

export const parseRegions = (regions: (typeof REGIONS)[number][]) =>
  parseAsArrayOf(
    parseAsStringLiteral(REGIONS.filter((region) => regions.includes(region))),
  ).withDefault(regions as unknown as (typeof REGIONS)[number][]);

export function CommandRegion({
  regions,
}: {
  regions: (typeof REGIONS)[number][];
}) {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const [selectedRegions, setSelectedRegions] = useQueryState(
    "regions",
    parseRegions(regions),
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
                        <span className="mr-1">{region.flag}</span>
                        {(() => {
                          switch (region.provider) {
                            case "fly":
                              return <Fly className="size-3" />;
                            case "koyeb":
                              return <Koyeb className="size-3" />;
                            case "railway":
                              return <Railway className="size-3" />;
                            default:
                              return <Globe className="size-3" />;
                          }
                        })()}
                        <span className="font-mono">
                          {region.code.replace(/(koyeb_|railway_|fly_)/g, "")}
                        </span>
                        <span className="ml-1 truncate text-muted-foreground text-xs">
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
