"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/src/components/select";
import type { ReactNode } from "react";

import { Icons } from "@/components/icons";
import type { ValidIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { useQueryState } from "nuqs";

export function SearchParamsPreset<T extends string>({
  disabled,
  defaultValue,
  values,
  searchParam,
  icon,
  placeholder,
  formatter,
  className,
}: {
  disabled?: boolean;
  defaultValue?: T;
  values: readonly T[] | T[];
  searchParam: string;
  icon?: ValidIcon;
  placeholder?: string;
  formatter?(value: T): ReactNode;
  className?: string;
}) {
  const [value, setValue] = useQueryState(searchParam, { shallow: false });

  const Icon = icon ? Icons[icon] : undefined;

  return (
    <Select
      defaultValue={defaultValue}
      value={value || defaultValue}
      onValueChange={setValue}
      disabled={disabled}
    >
      <SelectTrigger
        className={cn("w-[150px] bg-background text-left", className)}
      >
        <span className="flex items-center gap-2">
          {Icon ? <Icon className="h-4 w-4" /> : null}
          <SelectValue placeholder={placeholder} />
        </span>
      </SelectTrigger>
      <SelectContent>
        {values.map((value) => (
          <SelectItem key={value} value={value}>
            {formatter?.(value) || value}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
