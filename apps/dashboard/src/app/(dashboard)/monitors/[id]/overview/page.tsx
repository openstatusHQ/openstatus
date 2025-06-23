"use client";

import { ChartAreaLatency } from "@/components/chart/chart-area-latency";
import { ChartBarUptime } from "@/components/chart/chart-bar-uptime";
import { BlockWrapper } from "@/components/content/block-wrapper";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { columns } from "@/components/data-table/audit-logs/columns";
import { columns as regionColumns } from "@/components/data-table/response-logs/regions/columns";
import DatePicker from "@/components/date-picker";
import { MetricExample } from "@/components/metric/example";
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
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { auditLogs } from "@/data/audit-logs";
import { regionMetrics } from "@/data/region-metrics";
import { type Region, groupedRegions, regions } from "@/data/regions";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Check, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useState } from "react";

export default function Page() {
  const trpc = useTRPC();
  const { id } = useParams<{ id: string }>();
  const { data: monitor } = useQuery(
    trpc.monitor.get.queryOptions({ id: Number.parseInt(id) })
  );

  const [selectedRegions, setSelectedRegions] = useState<Region[]>(
    regions.map((r) => r.code)
  );

  const { data: metrics } = useQuery(
    trpc.tinybird.metrics.queryOptions({
      monitorId: id,
      period: "7d",
      type: monitor?.jobType as "http" | "tcp",
    })
  );

  console.log(metrics);

  if (!monitor) return null;

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>{monitor.name}</SectionTitle>
          <SectionDescription>{monitor.url}</SectionDescription>
        </SectionHeader>
        <div className="flex flex-wrap gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                Last 7 days
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <DatePicker />
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm">
                {selectedRegions.length === regions.length
                  ? "All Regions"
                  : `${selectedRegions.length} Regions`}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[200px] p-0">
              <CommandRegion
                selectedRegions={selectedRegions}
                setSelectedRegions={setSelectedRegions}
              />
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="sm">
            <X />
            Reset
          </Button>
        </div>
        <MetricExample />
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Uptime</SectionTitle>
          <SectionDescription>
            Uptime accross all the regions
          </SectionDescription>
        </SectionHeader>
        <ChartBarUptime />
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Latency</SectionTitle>
          <SectionDescription>
            Average latency accross all the regions
          </SectionDescription>
        </SectionHeader>
        <ChartAreaLatency />
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Timeline</SectionTitle>
          <SectionDescription>
            What&apos;s happening on your monitor
          </SectionDescription>
        </SectionHeader>
        <BlockWrapper>
          <DataTable
            columns={columns}
            data={auditLogs}
            paginationComponent={DataTablePaginationSimple}
          />
        </BlockWrapper>
      </Section>
      <Section>
        <SectionHeader>
          <SectionTitle>Regions</SectionTitle>
          <SectionDescription>
            Every region&apos;s latency over the last 24 hours
          </SectionDescription>
        </SectionHeader>
        <DataTable data={regionMetrics} columns={regionColumns} />
      </Section>
    </SectionGroup>
  );
}

function CommandRegion({
  selectedRegions,
  setSelectedRegions,
}: {
  selectedRegions: Region[];
  setSelectedRegions: React.Dispatch<React.SetStateAction<Region[]>>;
}) {
  return (
    <Command>
      <CommandInput placeholder="Search region..." />
      <CommandList>
        <CommandGroup forceMount>
          <CommandItem
            onSelect={() => {
              const items = document.querySelectorAll(
                '[data-slot="command-item"][data-disabled="false"]'
              );
              const codes: Region[] = [];

              items.forEach((item) => {
                const code = item.getAttribute("data-value");
                if (code && code !== "select-all") {
                  codes.push(code as Region);
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
        {Object.entries(groupedRegions).map(([continent, regionCodes]) => (
          <CommandGroup key={continent} heading={continent}>
            {regions
              .filter((region) => regionCodes.includes(region.code))
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
        ))}
        <CommandEmpty>No region found.</CommandEmpty>
      </CommandList>
    </Command>
  );
}
