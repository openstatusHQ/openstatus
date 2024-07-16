"use client";

import { usePathname, useRouter } from "next/navigation";

import type { MonitorFlyRegion } from "@openstatus/db/src/schema/shared/shared";
import { flyRegions } from "@openstatus/db/src/schema/shared/shared";
import {
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { regionFormatter } from "./utils";

export function SelectRegion({
  defaultValue,
}: {
  defaultValue?: MonitorFlyRegion;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const updateSearchParams = useUpdateSearchParams();

  function onSelect(value: string) {
    const searchParams = updateSearchParams({ region: value });
    router.replace(`${pathname}?${searchParams}`, { scroll: false });
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="region">Region</Label>
      <Select onValueChange={onSelect} defaultValue={defaultValue}>
        <SelectTrigger
          id="region"
          name="region"
          className="w-full sm:w-[240px]"
        >
          <span className="flex items-center gap-2">
            <SelectValue />
          </span>
        </SelectTrigger>
        <SelectContent>
          {flyRegions.map((region) => (
            <SelectItem key={region} value={region}>
              {regionFormatter(region, "long")}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-muted-foreground text-sm">
        Select a region to inspect closer
      </p>
    </div>
  );
}
