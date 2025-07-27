"use client";

import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { parseAsArrayOf, parseAsString, useQueryState } from "nuqs";

export function CommandTags() {
  const trpc = useTRPC();
  const { data: tags } = useQuery(trpc.monitorTag.list.queryOptions());
  const [selectedTags, setSelectedTags] = useQueryState(
    "tags",
    parseAsArrayOf(parseAsString).withDefault([]).withOptions({
      shallow: false,
    }),
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
        className="relative w-[200px] overflow-hidden p-0"
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
                        : [...prev, tag.name],
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
                        : "opacity-0",
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
