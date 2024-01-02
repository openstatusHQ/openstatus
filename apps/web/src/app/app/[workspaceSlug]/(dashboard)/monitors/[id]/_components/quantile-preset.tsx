"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { CandlestickChart } from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";

import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { quantiles } from "../utils";
import type { Quantile } from "../utils";

export function QuantilePreset({ quantile }: { quantile: Quantile }) {
  const router = useRouter();
  const pathname = usePathname();
  const updateSearchParams = useUpdateSearchParams();

  function onSelect(value: Quantile) {
    const searchParams = updateSearchParams({ quantile: value });
    router.replace(`${pathname}?${searchParams}`);
  }

  return (
    <Select onValueChange={onSelect} defaultValue={quantile}>
      <SelectTrigger className="w-[100px] uppercase">
        <span className="flex items-center gap-2">
          <CandlestickChart className="h-4 w-4" />
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent>
        {quantiles.map((quantile) => {
          return (
            <React.Fragment key={quantile}>
              {quantile === "avg" && <SelectSeparator />}
              <SelectItem value={quantile} className="uppercase">
                {quantile}
              </SelectItem>
            </React.Fragment>
          );
        })}
      </SelectContent>
    </Select>
  );
}
