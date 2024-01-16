"use client";

import { usePathname, useRouter } from "next/navigation";

import type { MonitorFlyRegion } from "@openstatus/db/src/schema";
import { flyRegions } from "@openstatus/db/src/schema";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";

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
    <Select onValueChange={onSelect} defaultValue={defaultValue}>
      <SelectTrigger className="w-[100px]">
        <span className="flex items-center gap-2">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {flyRegions.map((region) => (
          <SelectItem key={region} value={region}>
            {region}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
