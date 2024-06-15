"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
} from "@openstatus/ui";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

export type Event = {
  public: boolean;
  active: boolean;
  regions: ("ams" | "gru" | "syd")[];
  name: string;
};

interface InputSearchProps {
  onSearch(value: Record<string, string | string[]>): void;
  events: Event[]; // TODO: instead of events, lets pass in a zod schema!
}

export function InputSearch({ events, onSearch }: InputSearchProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>("");
  const [currentWord, setCurrentWord] = useState("");

  // TODO: create a debounce an update the value every 500ms!
  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    const searchparams = inputValue
      .trim()
      .split(" ")
      .reduce(
        (prev, curr) => {
          const [name, value] = curr.split(":");
          if (value && name && curr !== currentWord) {
            // TODO: support multiple value with value.split(",")
            const values = value.split(",");
            console.log({ values });
            if (values.length > 1) {
              prev[name] = values;
            } else {
              prev[name] = value;
            }
          }
          return prev;
        },
        {} as Record<string, string | string[]>,
      );
    onSearch(searchparams);
  }, [inputValue, currentWord]);

  // DEFINE YOUR SEARCH PARAMETERS
  const search = useMemo(
    () =>
      events?.reduce(
        (prev, curr) => {
          return {
            // biome-ignore lint/performance/noAccumulatingSpread: <explanation>
            ...prev,
            public: [...new Set([curr.public, ...(prev.public || [])])],
            regions: [...new Set([...curr.regions, ...(prev.regions || [])])],
          };
        },
        // defaultState
        {
          limit: [10, 25, 50],
          public: [true, false],
          regions: ["ams", "gru", "syd"],
        } as {
          public: boolean[];
          limit: number[];
          regions: string[];
        },
      ),
    [events],
  );

  type SearchKey = keyof typeof search;

  return (
    <Command
      className="rounded-lg border shadow-md"
      filter={(value, search) => {
        if (value.includes(currentWord.toLowerCase())) return 1;
        /**
         * @example [filter, query] = ["regions", "ams,gru"]
         */
        const [filter, query] = currentWord.toLowerCase().split(":");
        if (query) {
          /**
           * @example queries = ["ams", "gru"]
           */
          const queries = query.split(",");
          const extendedQueries = queries?.map((item) => `${filter}:${item}`);
          if (extendedQueries.some((item) => item === value)) return 0;
          if (extendedQueries.some((item) => value.includes(item))) return 1;
        }
        return 0;
      }}
    >
      <CommandInput
        ref={inputRef}
        value={inputValue}
        onValueChange={setInputValue}
        onKeyDown={(e) => {
          if (e.key === "Escape") inputRef?.current?.blur();
        }}
        // onBlur={() => setOpen(false)}
        // onFocus={() => setOpen(true)}
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
      />
      {/* {open ? ( */}
      <CommandList>
        <CommandGroup heading="Filter">
          {Object.keys(search).map((key) => {
            if (inputValue.includes(`${key}:`)) return null;
            return (
              <CommandItem
                key={key}
                value={key}
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                }}
                onSelect={(value) => {
                  setInputValue((prev) => {
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
                <span className="ml-1 hidden truncate text-muted-foreground/90 group-aria-[selected=true]:block">
                  {search[key as SearchKey].map((str) => `[${str}]`).join(" ")}
                </span>
              </CommandItem>
            );
          })}
        </CommandGroup>
        <CommandGroup heading="Query">
          {Object.keys(search).map((key) => {
            if (!currentWord.includes(`${key}:`)) return null;
            return search[key as SearchKey].map((option) => {
              return (
                <CommandItem
                  key={`${key}`}
                  value={`${key}:${option}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onSelect={(value) => {
                    setInputValue((prev) => {
                      console.log({ currentWord, value, prev });
                      if (currentWord.includes(",")) {
                        return `${prev}${option} `;
                      }
                      const input = prev.replace(currentWord, value);
                      return `${input.trim()} `;
                    });
                    setCurrentWord("");
                  }}
                  {...{ currentWord }}
                >
                  {`${option}`}
                </CommandItem>
              );
            });
          })}
        </CommandGroup>
        <CommandEmpty>No results found.</CommandEmpty>
      </CommandList>
      {/* ) : null} */}
    </Command>
  );
}

export function FakeInput({ className }: { className?: string }) {
  return (
    <div className="flex items-center border border-border rounded-lg px-3 w-min">
      <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
      <button
        className={cn(
          "placeholder:text-foreground-muted flex h-11 w-64 rounded-md bg-transparent py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      />
    </div>
  );
}
