"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { SelectTrigger } from "@radix-ui/react-select";
import { parseAsStringLiteral, useQueryState } from "nuqs";

import { PERCENTILES } from "@/data/metrics.client";

const parsePercentile = parseAsStringLiteral(PERCENTILES).withDefault("p50");

export function DropdownPercentile() {
  const [percentile, setPercentile] = useQueryState(
    "percentile",
    parsePercentile,
  );

  return (
    <Select
      value={percentile}
      onValueChange={(value) =>
        setPercentile(value as (typeof PERCENTILES)[number])
      }
    >
      <SelectTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="decoration-border hover:decoration-foreground data-[state=open]:decoration-foreground h-auto rounded-md px-1 py-0 text-[length:inherit] leading-[inherit] font-medium capitalize underline underline-offset-3 hover:bg-transparent dark:hover:bg-transparent"
        >
          <SelectValue />
        </Button>
      </SelectTrigger>
      <SelectContent position="item-aligned">
        <SelectGroup>
          <SelectLabel>Percentile</SelectLabel>
          {PERCENTILES.map((item) => (
            <SelectItem key={item} value={item} className="capitalize">
              {item}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
}
