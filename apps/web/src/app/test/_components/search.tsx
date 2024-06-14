"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@openstatus/ui";

type Event = {
  public: boolean;
  active: boolean;
  regions: ("ams" | "gru" | "syd")[];
  name: string;
};

export function InputSearch({
  events,
  onSearch,
}: {
  onSearch(value: Record<string, string>): void;
  events: Event[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>("");
  const [currentWord, setCurrentWord] = useState("");

  // TODO: check if there is a move efficient way
  useEffect(() => {
    const searchparams = inputValue
      .trim()
      .split(" ")
      .reduce(
        (prev, curr) => {
          const [name, value] = curr.split(":");
          if (value && name && curr !== currentWord) {
            // TODO: support multiple value with value.split(",")
            prev[name] = value;
          }
          return prev;
        },
        {} as Record<string, string>,
      );
    onSearch(searchparams);
  }, [onSearch, inputValue, currentWord]);

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
      />
      {open ? (
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
                    {search[key as SearchKey]
                      .map((str) => `[${str}]`)
                      .join(" ")}
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
      ) : null}
    </Command>
  );
}
