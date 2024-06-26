"use client";

import React, { useEffect, useRef, useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Separator,
} from "@openstatus/ui";
import { Search } from "lucide-react";

import { cn } from "@/lib/utils";

import { Kbd } from "@/components/kbd";
import type { Table } from "@tanstack/react-table";
import type { z } from "zod";
import type { DataTableFilterField } from "./types";
import { deserialize, serializeColumFilters } from "./utils";

interface DataTableFilterCommandProps<TData, TSchema extends z.AnyZodObject> {
  table: Table<TData>;
  schema: TSchema;
  filterFields?: DataTableFilterField<TData>[];
}

export function DataTableFilterCommand<TData, TSchema extends z.AnyZodObject>({
  schema,
  table,
  filterFields,
}: DataTableFilterCommandProps<TData, TSchema>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>("");
  const [currentWord, setCurrentWord] = useState("");
  const columnFilters = table.getState().columnFilters;

  // DISCUSS: maybe we can rework the component to use the new DataTableFilterField type!
  // otherwise useMemo!
  const values =
    filterFields?.reduce(
      (prev, curr) => {
        prev[curr.value] = curr.options?.map(({ value }) => value) || [];
        return prev;
      },
      {} as Record<keyof TData, unknown>,
    ) || ({} as Record<keyof TData, unknown>);

  useEffect(() => {
    if (open) return;
    const newInputValue = serializeColumFilters(columnFilters);
    setInputValue(newInputValue);
  }, [columnFilters, open]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: no need for `table` in dependency array as we only use setter functions
  useEffect(() => {
    if (!inputValue.endsWith(" ") && open) return;
    const searchparams = deserialize(schema)(inputValue);
    if (searchparams.success) {
      // need to reset the filters as we don't remove filter values
      table.resetColumnFilters();

      for (const key of Object.keys(searchparams.data)) {
        table
          .getColumn(key)
          ?.setFilterValue(
            searchparams.data[key as keyof typeof searchparams.data],
          );
      }
    }
  }, [inputValue, open]);

  return (
    <div>
      <div
        className={cn(
          "group flex w-full items-center rounded-lg border border-input bg-background px-3",
          open ? "hidden" : "visible",
        )}
      >
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <button
          type="button"
          className="h-11 w-full max-w-sm truncate py-3 text-left text-sm outline-none md:max-w-xl xl:max-w-2xl disabled:cursor-not-allowed disabled:opacity-50"
          onClick={(e) => {
            e.preventDefault();
            setOpen(true);
            setTimeout(() => inputRef?.current?.focus(), 200);
          }}
        >
          {inputValue.trim() ? (
            inputValue
          ) : (
            <span className="text-muted-foreground">Search data table...</span>
          )}
        </button>
      </div>
      <Command
        className={cn(
          "overflow-visible rounded-lg border shadow-md",
          open ? "visible" : "hidden",
        )}
        filter={(value, _search) => {
          // console.log({ value, _search, currentWord });
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
          placeholder="Search data table..."
        />
        <div className="relative">
          <div className="absolute top-2 z-10 w-full animate-in rounded-lg border bg-popover text-popover-foreground shadow-md outline-none">
            <CommandList>
              <CommandGroup heading="Filter">
                {Object.keys(values).map((key) => {
                  if (inputValue.includes(`${key}:`)) return null;
                  const items = values[key as keyof typeof values];
                  if (!Array.isArray(items)) return null;
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
                      <span className="ml-1 hidden truncate text-muted-foreground/80 group-aria-[selected=true]:block">
                        {items
                          .map((str: string | boolean | number) => `[${str}]`)
                          .join(" ")}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Query">
                {Object.keys(values).map((key) => {
                  if (!currentWord.includes(`${key}:`)) return null;
                  const items = values[key as keyof typeof values];
                  if (!Array.isArray(items)) return null;
                  return items.map((option: string | boolean | number) => {
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
                            if (currentWord.includes(",")) {
                              const words = currentWord.split(",");
                              words[words.length - 1] = `${option}`;
                              const input = prev.replace(
                                currentWord,
                                words.join(","),
                              );
                              return `${input.trim()} `;
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
            <div
              className="flex flex-wrap gap-3 border-t bg-accent/50 px-2 py-1.5 text-accent-foreground text-sm"
              cmdk-footer=""
            >
              <span>
                Use <Kbd className="bg-background">↑</Kbd>{" "}
                <Kbd className="bg-background">↓</Kbd> to navigate
              </span>
              <span>
                <Kbd className="bg-background">Enter</Kbd> to query
              </span>
              <span>
                <Kbd className="bg-background">Esc</Kbd> to close
              </span>
              <Separator orientation="vertical" className="my-auto h-3" />
              <span>
                Union: <Kbd className="bg-background">regions:a,b</Kbd>
              </span>
            </div>
          </div>
        </div>
      </Command>
    </div>
  );
}
