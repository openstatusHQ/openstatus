"use client";

import * as React from "react";
import { Command as CommandPrimitive, useCommandState } from "cmdk";

import type { Ping } from "@openstatus/tinybird";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";

// TODO: once stable, use the shallow route to store the search params inside of the search params

export function InputSearch({
  events,
  onSearch,
}: {
  onSearch(value: Record<string, string>): void;
  events: Ping[];
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState<boolean>(false);
  const [inputValue, setInputValue] = React.useState<string>("");
  const [currentWord, setCurrentWord] = React.useState("");

  // TODO: check if there is a move efficient way
  React.useEffect(() => {
    const searchparams = inputValue
      .trim()
      .split(" ")
      .reduce((prev, curr) => {
        const [name, value] = curr.split(":");
        if (value && name && curr !== currentWord) {
          // TODO: support multiple value with value.split(",")
          prev[name] = value;
        }
        return prev;
      }, {} as Record<string, string>);
    onSearch(searchparams);
  }, [onSearch, inputValue]);

  // DEFINE YOUR SEARCH PARAMETERS
  const search = React.useMemo(
    () =>
      events.reduce(
        (prev, curr) => {
          return {
            ...prev,
            status: [...new Set([curr.statusCode, ...(prev.status || [])])],
            region: [...new Set([curr.region, ...(prev.region || [])])],
          };
        },
        // defaultState
        { limit: [10, 25, 50], status: [], region: [] } as {
          status: number[];
          limit: number[];
          region: string[];
        },
      ),
    [events],
  );

  type SearchKey = keyof typeof search;

  return (
    <Command
      className="overflow-visible bg-transparent"
      filter={(value, search) => {
        if (value.includes(currentWord.toLowerCase())) return 1;
        return 0;
      }}
    >
      <CommandPrimitive.Input
        ref={inputRef}
        value={inputValue}
        onValueChange={setInputValue}
        onKeyDown={(e) => {
          if (e.key === "Escape") inputRef?.current?.blur();
        }}
        onBlur={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onInput={(e) => {
          const caretPositionStart = e.currentTarget?.selectionStart || -1;
          const inputValue = e.currentTarget?.value || "";

          let start = caretPositionStart;
          let end = caretPositionStart;

          while (start > 0 && inputValue[start - 1] !== " ") {
            start--;
          }
          while (end < inputValue.length && inputValue[end] !== " ") {
            end++;
          }

          const word = inputValue.substring(start, end);
          setCurrentWord(word);
        }}
        placeholder={`${events.length} total logs found...`}
        className="border-input ring-offset-background placeholder:text-muted-foreground focus:ring-ring flex-1 rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-offset-2"
      />
      <div className="relative mt-2">
        {open ? (
          <div className="bg-popover text-popover-foreground animate-in absolute top-0 z-10 w-full rounded-md border shadow-md outline-none">
            <CommandGroup className="max-h-64 overflow-auto">
              {Object.keys(search).map((key) => {
                if (
                  inputValue.includes(`${key}:`) &&
                  !currentWord.includes(`${key}:`)
                )
                  return null;
                return (
                  <React.Fragment key={key}>
                    <CommandItem
                      value={key}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                      }}
                      onSelect={(value) => {
                        setInputValue((prev) => {
                          // console.log({ prev, currentWord, value });
                          if (currentWord.trim() === "") {
                            const input = `${prev}${value}`;
                            return `${input}:`;
                          }
                          // lots of cheat
                          const isStarting = currentWord === prev;
                          const prefix = isStarting ? "" : " ";
                          const input = prev.replace(
                            `${prefix}${currentWord}`,
                            `${prefix}${value}`,
                          );
                          return `${input}:`;
                        });
                        setCurrentWord(`${value}:`);
                      }}
                      className="group"
                    >
                      {key}
                      <span className="text-muted-foreground/90 ml-1 hidden truncate group-aria-[selected=true]:block">
                        {search[key as SearchKey]
                          .map((str) => `[${str}]`)
                          .join(" ")}
                      </span>
                    </CommandItem>
                    {search[key as SearchKey].map((option) => {
                      return (
                        <SubItem
                          key={option}
                          value={`${key}:${option}`}
                          onMouseDown={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          onSelect={(value) => {
                            setInputValue((prev) => {
                              const input = prev.replace(currentWord, value);
                              return `${input.trim()} `;
                            });
                            setCurrentWord("");
                          }}
                          {...{ currentWord }}
                        >
                          {option}
                        </SubItem>
                      );
                    })}
                  </React.Fragment>
                );
              })}
            </CommandGroup>
            <CommandEmpty>No results found.</CommandEmpty>
          </div>
        ) : null}
      </div>
    </Command>
  );
}

interface SubItemProps
  extends React.ComponentPropsWithoutRef<typeof CommandPrimitive.Item> {
  currentWord: string;
}

const SubItem = ({ currentWord, ...props }: SubItemProps) => {
  const search = useCommandState((state) => state.search);
  if (!search.includes(":") || !currentWord.includes(":")) return null;
  return <CommandItem {...props} />;
};
