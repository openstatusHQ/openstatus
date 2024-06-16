"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";

import { z } from "zod";
import { Kbd } from "@/components/kbd";
import { ColumnFiltersState } from "@tanstack/react-table";

function deserialize<T extends z.ZodTypeAny>(schema: T) {
  const castToSchema = z.preprocess((val) => {
    console.log({ val });
    if (typeof val !== "string") return val;
    return val
      .trim()
      .split(" ")
      .reduce(
        (prev, curr) => {
          const [name, value] = curr.split(":");
          if (!value || !name) return prev;

          if (!value.includes(",")) {
            prev[name] = [value];
            return prev;
          }
          console.log(">>>", value);
          const values = value.split(",");
          console.log(">>>>", values);
          prev[name] = values;
          return prev;
        },
        {} as Record<string, unknown>,
      );
  }, schema);
  return (value: string) => castToSchema.safeParse(value);
}

function serialize<T extends z.ZodTypeAny>(value: z.infer<T>) {
  return ""; // return "regions:ams,gru active:true" from object / zod object
}

interface InputSearchProps<T extends z.ZodTypeAny> {
  onSearch(value: z.infer<T>): void;
  schema: T;
  defaultValue?: z.infer<T>;
}

export function InputSearch<T extends z.ZodTypeAny>({
  onSearch,
  schema,
}: InputSearchProps<T>) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [inputValue, setInputValue] = useState<string>("");
  const [currentWord, setCurrentWord] = useState("");

  // TODO: create a debounce an update the value every 500ms!

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  useEffect(() => {
    if (!inputValue.endsWith(" ") || !open) return;
    const searchparams = deserialize(schema)(inputValue);
    console.log(searchparams);
    if (searchparams.success) {
      onSearch(searchparams.data);
    }
  }, [inputValue, open]);

  // DEFINE YOUR SEARCH PARAMETERS FROM ZOD!
  const search = {
    limit: [10, 25, 50],
    public: [true, false],
    active: [true, false],
    regions: ["ams", "gru", "syd"],
  };

  return (
    <div>
      <div
        className={cn(
          "group flex w-full max-w-64 items-center border border-input bg-background rounded-lg px-3",
          open ? "hidden" : "visible",
        )}
      >
        <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
        <button
          type="button"
          className="flex h-11 w-full py-3 text-sm outline-none disabled:cursor-not-allowed disabled:opacity-50"
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
        {/* maybe move everything into one component */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setInputValue("")}
                className={cn("-mr-1.5", inputValue ? "visible" : "invisible")}
              >
                <X className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="flex items-center">
              <p className="mr-2">Clear filter</p>
              <Kbd abbrTitle="Escape" variant="outline">
                Esc
              </Kbd>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <Command
        className={cn(
          "overflow-visible rounded-lg border shadow-md",
          open ? "visible" : "hidden",
        )}
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
          <div className="absolute top-2 z-10 w-full rounded-lg border bg-popover text-popover-foreground shadow-md outline-none animate-in">
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
                        {search[key as keyof typeof search]
                          .map((str) => `[${str}]`)
                          .join(" ")}
                      </span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
              <CommandSeparator />
              <CommandGroup heading="Query">
                {Object.keys(search).map((key) => {
                  if (!currentWord.includes(`${key}:`)) return null;
                  return search[key as keyof typeof search].map((option) => {
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
                              const values = currentWord.split(",");
                              values[values.length - 1] = `${option}`;
                              const input = prev.replace(
                                currentWord,
                                values.join(","),
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
          </div>
        </div>
      </Command>
    </div>
  );
}
