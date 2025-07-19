"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { parseAsArrayOf, useQueryState, parseAsString } from "nuqs";
import React from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

export function CommandTags() {
  const trpc = useTRPC();
  const { data: tags } = useQuery(trpc.monitorTag.list.queryOptions());
  const [selectedTags, setSelectedTags] = useQueryState(
    "tags",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({
      shallow: false,
    })
  );

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm">
          {selectedTags.length === (tags?.length ?? 0)
            ? "All Tags"
            : `${selectedTags.length} Tags`}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[200px] p-0 relative overflow-hidden"
      >
        <Command>
          <CommandInput placeholder="Search tag..." />
          <CommandList>
            <CommandGroup>
              {tags?.map((tag) => (
                <CommandItem
                  key={tag.id}
                  value={tag.name}
                  keywords={[tag.name]}
                  onSelect={() => {
                    setSelectedTags((prev) =>
                      prev.includes(tag.name)
                        ? prev.filter((r) => r !== tag.name)
                        : [...prev, tag.name]
                    );
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="size-2.5 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {tag.name}
                  </div>
                  <Check
                    className={cn(
                      "ml-auto",
                      selectedTags.includes(tag.name)
                        ? "opacity-100"
                        : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
            <CommandEmpty>No tag found.</CommandEmpty>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
