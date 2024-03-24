"use client";

import { Globe2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import * as React from "react";

import type { Region } from "@openstatus/tinybird";
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstatus/ui";
import { flyRegionsDict } from "@openstatus/utils";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { cn } from "@/lib/utils";

export function RegionsPreset({
  regions,
  selectedRegions,
  className,
}: {
  regions: Region[];
  selectedRegions: Region[];
  className?: string;
}) {
  const [selected, setSelected] = React.useState<Region[]>(selectedRegions);
  const router = useRouter();
  const pathname = usePathname();
  const updateSearchParams = useUpdateSearchParams();

  function onOpenChange(open: boolean) {
    if (!open) {
      const searchParams = updateSearchParams({ regions: selected.join(",") });
      router.replace(`${pathname}?${searchParams}`, { scroll: false });
    }
  }

  const allSelected = regions.every((r) => selected.includes(r));

  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <Button
          size="lg"
          variant="outline"
          className={cn("px-3 shadow-none", className)}
        >
          <span className="flex items-center gap-2">
            <Globe2 className="h-4 w-4" />
            <code>{selected.length}</code> Regions
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent>
        <DropdownMenuCheckboxItem
          checked={allSelected}
          onCheckedChange={(checked) => setSelected(checked ? regions : [])}
        >
          All regions
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {regions.map((region) => {
          const { code, flag } = flyRegionsDict[region];
          return (
            <DropdownMenuCheckboxItem
              key={region}
              onSelect={(e) => e.preventDefault()}
              checked={selected.includes(region)}
              onCheckedChange={(checked) => {
                setSelected((prev) =>
                  checked
                    ? [...prev, region]
                    : prev.filter((r) => r !== region),
                );
              }}
              className="font-mono"
            >
              {flag} {code}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
