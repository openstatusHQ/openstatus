"use client";

import { usePathname, useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { example } from "../config";

// FIXME: make it dynamic or include all the possible regions
const regions = example.map(({ name }) => name);

export function SelectRegion({ defaultValue }: { defaultValue?: string }) {
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
          {/* <Hourglass className="h-4 w-4" /> */}
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {regions.map((region) => (
          <SelectItem key={region} value={region}>
            {region}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
