"use client";

import { TextShimmer } from "@openstatus/ui/components/data-table-filters/data-table-filter-command-ai/text-shimmer";
import {
  columnFiltersParserFromSchema,
  getFieldOptions,
  getFilterValue,
  getWordByCaretPosition,
  replaceInputByFieldType,
} from "@openstatus/ui/components/data-table-filters/data-table-filter-command/utils";
import { useDataTable } from "@openstatus/ui/components/data-table-filters/data-table-provider";
import type { DataTableFilterField } from "@openstatus/ui/components/data-table-filters/types";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@openstatus/ui/components/ui/command";
import { Kbd } from "@openstatus/ui/components/ui/kbd";
import { Separator } from "@openstatus/ui/components/ui/separator";
import { useHotKey } from "@openstatus/ui/hooks/use-hot-key";
import { useLocalStorage } from "@openstatus/ui/hooks/use-local-storage";
import { isStructuredQuery } from "@openstatus/ui/lib/data-table-filters/ai/index";
import { useAIFilters } from "@openstatus/ui/lib/data-table-filters/hooks/use-ai-filters";
import { getCommandHistoryKey } from "@openstatus/ui/lib/data-table-filters/local-storage";
import type { SchemaDefinition } from "@openstatus/ui/lib/data-table-filters/store/schema/types";
import type { TableSchemaDefinition } from "@openstatus/ui/lib/data-table-filters/table-schema/index";
import { formatCompactNumber } from "@openstatus/ui/lib/format";
import { cn } from "@openstatus/ui/lib/utils";
import { Command as CommandPrimitive } from "cmdk";
import { formatDistanceToNow } from "date-fns";
import { LoaderCircle, Search, Sparkles, X } from "lucide-react";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

/** Suggestions kept in localStorage; only the newest five are ever rendered. */
const MAX_COMMAND_HISTORY = 25;

interface DataTableFilterAICommandProps {
  /** BYOS schema definition for parsing/serializing filter values */
  schema: SchemaDefinition;
  /** Table schema definition for AI context generation */
  tableSchema: TableSchemaDefinition;
  /** API endpoint that streams AI filter results */
  api: string;
  /** Unique ID for this table (used to namespace localStorage) */
  tableId?: string;
}

export function DataTableFilterAICommand({
  schema,
  tableSchema,
  api,
  tableId = "default",
}: DataTableFilterAICommandProps) {
  const {
    table,
    isLoading,
    filterFields: _filterFields,
    getFacetedUniqueValues,
  } = useDataTable();
  const columnFilters = table.getState().columnFilters;
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState<boolean>(false);
  const [currentWord, setCurrentWord] = useState<string>("");
  const isSerializingRef = useRef(false);
  const filterFields = useMemo(
    () => _filterFields?.filter((i) => !i.commandDisabled),
    [_filterFields],
  );
  const columnParser = useMemo(
    () => columnFiltersParserFromSchema({ schema, filterFields }),
    [schema, filterFields],
  );
  const [inputValue, setInputValue] = useState<string>(
    columnParser.serialize(columnFilters),
  );
  const [lastSearches, setLastSearches] = useLocalStorage<
    {
      search: string;
      timestamp: number;
    }[]
  >(getCommandHistoryKey(tableId), []);

  // Detect if the current input looks like natural language (for UI hints).
  // Single-word input that partially matches a field name → structured mode.
  // Multi-word input without key:value syntax → natural language mode.
  const isNaturalLanguage = useMemo(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) return false;
    if (isStructuredQuery(trimmed, tableSchema)) return false;

    const words = trimmed.split(/\s+/);

    // Single word: only treat as natural language if it doesn't match any field
    if (words.length === 1) {
      const word = words[0]!.toLowerCase();
      const matchesField = filterFields.some((f) => {
        const key = String(f.value).toLowerCase();
        return key.startsWith(word) || key.includes(word);
      });
      if (matchesField) return false;
    }

    // Multiple words without key:value → natural language
    return (
      words.length > 1 ||
      !filterFields.some((f) => {
        const key = String(f.value).toLowerCase();
        return key === words[0]?.toLowerCase();
      })
    );
  }, [inputValue, tableSchema, filterFields]);

  // Track the last AI query for display while loading
  const [aiQuery, setAIQuery] = useState<string | null>(null);
  // Taken before the replace-all reset so a failed request can be undone.
  const previousFiltersRef = useRef<{ id: string; value: unknown }[] | null>(
    null,
  );

  /**
   * Replace-all: every filterable field missing from `filters` is cleared.
   * Iterates `_filterFields`, not the command-visible subset, so a
   * command-disabled field (the timerange) cannot survive as a stale constraint.
   */
  function applyFilterSet(filters: { id: string; value: unknown }[]) {
    const next = new Map(filters.map((filter) => [filter.id, filter.value]));
    for (const field of _filterFields ?? []) {
      if (typeof field.value !== "string") continue;
      table.getColumn(field.value)?.setFilterValue(next.get(field.value));
    }
  }

  // AI filters hook
  const { infer, isLoading: isAILoading } = useAIFilters({
    api,
    tableSchema,
    onField(key, value) {
      table.getColumn(key)?.setFilterValue(value);
    },
    onFinish(state) {
      // Final reconciliation: the validated state is the whole truth, so fields
      // that were applied progressively but did not validate get cleared here.
      const validated = Object.entries(state).map(([id, value]) => ({
        id,
        value,
      }));
      applyFilterSet(validated);
      previousFiltersRef.current = null;
      // Serialize from the validated state directly to avoid stale table state
      isSerializingRef.current = true;
      setInputValue(columnParser.serialize(validated));
    },
    onComplete() {
      setAIQuery(null);
    },
    onStart() {
      previousFiltersRef.current = table
        .getState()
        .columnFilters.map(({ id, value }) => ({ id, value }));
      // Clear existing filters before AI applies new ones (replace-all strategy)
      applyFilterSet([]);
    },
    onError(error) {
      // A failed request must not leave the table on a query the user never
      // asked for: put the pre-request filters back.
      applyFilterSet(previousFiltersRef.current ?? []);
      previousFiltersRef.current = null;
      setAIQuery(null);
      toast.error("Failed to infer filters", {
        description: error.message,
      });
    },
  });

  useEffect(() => {
    if (isSerializingRef.current) {
      isSerializingRef.current = false;
      return;
    }
    if (currentWord !== "" && open) return;
    if (currentWord !== "" && !open) setCurrentWord("");
    if (inputValue.trim() === "" && !open) return;

    const searchParams = columnParser.parse(inputValue);

    const currentFilters = table.getState().columnFilters;
    const currentEnabledFilters = currentFilters.filter((filter) => {
      const field = _filterFields?.find((field) => field.value === filter.id);
      return !field?.commandDisabled;
    });
    for (const key of Object.keys(searchParams)) {
      const value = searchParams[key as keyof typeof searchParams];
      table.getColumn(key)?.setFilterValue(value);
    }
    const currentFiltersToReset = currentEnabledFilters.filter((filter) => {
      return !(filter.id in searchParams);
    });
    for (const filter of currentFiltersToReset) {
      table.getColumn(filter.id)?.setFilterValue(undefined);
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputValue, open, currentWord]);

  useEffect(() => {
    if (!open) {
      isSerializingRef.current = true;
      setInputValue(columnParser.serialize(columnFilters));
    }
  }, [columnFilters, filterFields, open]);

  useHotKey(() => setOpen((open) => !open), "j");

  useEffect(() => {
    if (open) {
      inputRef?.current?.focus();
    }
  }, [open]);

  function handleClose() {
    setOpen(false);
    const search = inputValue.trim();
    if (!search) return;
    const timestamp = Date.now();
    const searchIndex = lastSearches.findIndex(
      (item) => item.search === search,
    );
    if (searchIndex !== -1) {
      setLastSearches(
        lastSearches.map((item, i) =>
          i === searchIndex ? { ...item, timestamp } : item,
        ),
      );
      return;
    }
    // Only the newest few are ever shown, and every entry is re-serialised into
    // localStorage on each write — so keep the stored history bounded.
    setLastSearches(
      [...lastSearches, { search, timestamp }]
        .sort((a, b) => b.timestamp - a.timestamp)
        .slice(0, MAX_COMMAND_HISTORY),
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      inputRef?.current?.blur();
      return;
    }
    if (e.key === "Enter" && isNaturalLanguage) {
      // Let cmdk handle Enter if an item is selected (e.g., a suggestion)
      const selected = document.querySelector("[cmdk-item][data-selected]");
      if (selected) return;

      e.preventDefault();
      const query = inputValue.trim();
      const handled = infer(inputValue);
      if (handled) {
        setAIQuery(query);
        handleClose();
      }
    }
  }

  return (
    <div>
      <button
        type="button"
        className={cn(
          "group border-input bg-background text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground focus-within:border-ring focus-within:ring-ring/50 flex w-full items-center rounded-lg border px-3 transition-all outline-none focus-within:ring-[3px]",
          open ? "hidden" : "visible",
        )}
        onClick={() => setOpen(true)}
      >
        {isLoading || isAILoading ? (
          <LoaderCircle className="text-muted-foreground group-hover:text-popover-foreground mr-2 h-4 w-4 shrink-0 animate-spin opacity-50" />
        ) : (
          <Search className="text-muted-foreground group-hover:text-popover-foreground mr-2 h-4 w-4 shrink-0 opacity-50" />
        )}
        <span className="h-11 w-full max-w-sm truncate py-3 text-left text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50 md:max-w-xl lg:max-w-4xl xl:max-w-5xl">
          {aiQuery ? (
            <TextShimmer duration={2}>{aiQuery}</TextShimmer>
          ) : inputValue.trim() ? (
            <span className="text-foreground">{inputValue}</span>
          ) : (
            <span>Search data table...</span>
          )}
        </span>
        <Kbd className="text-muted-foreground group-hover:text-accent-foreground ml-auto">
          <span className="mr-1">⌘</span>
          <span>J</span>
        </Kbd>
      </button>
      <Command
        className={cn(
          "border-border dark:bg-muted/50 overflow-visible rounded-lg border shadow-md [&>div]:border-none",
          open ? "visible" : "hidden",
        )}
        filter={(value, search, keywords) =>
          getFilterValue({ value, search, keywords, currentWord })
        }
      >
        <div
          data-slot="command-input-wrapper"
          className="flex items-center gap-2 border-b px-3"
        >
          <Search className="size-4 shrink-0 opacity-50" />
          <CommandPrimitive.Input
            ref={inputRef}
            value={inputValue}
            onValueChange={setInputValue}
            onKeyDown={handleKeyDown}
            onBlur={handleClose}
            onInput={(e: React.FormEvent<HTMLInputElement>) => {
              const caretPosition = e.currentTarget?.selectionStart || -1;
              const value = e.currentTarget?.value || "";
              const word = getWordByCaretPosition({ value, caretPosition });
              setCurrentWord(word);
            }}
            placeholder="Search data table..."
            className="text-foreground placeholder:text-muted-foreground flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>
        <div className="relative">
          <div className="border-border bg-popover text-popover-foreground animate-in absolute top-2 z-10 w-full overflow-hidden rounded-lg border shadow-md outline-hidden">
            <CommandList className="max-h-[310px]">
              {!isNaturalLanguage && (
                <>
                  <CommandGroup heading="Filter">
                    {filterFields.map((field) => {
                      if (typeof field.value !== "string") return null;
                      if (inputValue.includes(`${field.value}:`)) return null;
                      return (
                        <CommandItem
                          key={field.value}
                          value={field.value}
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
                          {field.value}
                          <CommandItemSuggestions field={field} />
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                  <CommandSeparator />
                  <CommandGroup heading="Query">
                    {filterFields?.map((field) => {
                      if (typeof field.value !== "string") return null;
                      if (!currentWord.includes(`${field.value}:`)) return null;

                      const column = table.getColumn(field.value);
                      const facetedValue =
                        getFacetedUniqueValues?.(table, field.value) ||
                        column?.getFacetedUniqueValues();

                      const options = getFieldOptions({ field, facetedValue });

                      return options.map((optionValue) => {
                        return (
                          <CommandItem
                            key={`${String(field.value)}:${optionValue}`}
                            value={`${String(field.value)}:${optionValue}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onSelect={(value) => {
                              setInputValue((prev) =>
                                replaceInputByFieldType({
                                  prev,
                                  currentWord,
                                  optionValue,
                                  value,
                                  field,
                                }),
                              );
                              setCurrentWord("");
                            }}
                          >
                            {`${optionValue}`}
                            {facetedValue?.has(optionValue) ? (
                              <span className="text-muted-foreground ml-auto font-mono">
                                {formatCompactNumber(
                                  facetedValue.get(optionValue) || 0,
                                )}
                              </span>
                            ) : null}
                          </CommandItem>
                        );
                      });
                    })}
                  </CommandGroup>
                  <CommandEmpty>No results found.</CommandEmpty>
                </>
              )}
              {isNaturalLanguage && inputValue.trim() && (
                <CommandGroup heading="Infer">
                  <CommandItem
                    value={`ai:${inputValue.trim()}`}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onSelect={() => {
                      const query = inputValue.trim();
                      const handled = infer(inputValue);
                      if (handled) {
                        setAIQuery(query);
                        handleClose();
                      }
                    }}
                  >
                    <Sparkles className="size-4 shrink-0" />
                    {inputValue.trim()}
                    <span className="text-muted-foreground ml-auto text-xs">
                      describe your query to infer filters
                    </span>
                  </CommandItem>
                </CommandGroup>
              )}
              {lastSearches.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Suggestions">
                    {[...lastSearches]
                      .sort((a, b) => b.timestamp - a.timestamp)
                      .slice(0, 5)
                      .map((item) => {
                        return (
                          <CommandItem
                            key={`suggestion:${item.search}`}
                            value={`suggestion:${item.search}`}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onSelect={(value) => {
                              const search = value.replace("suggestion:", "");
                              setInputValue(`${search} `);
                              setCurrentWord("");
                            }}
                            className="group"
                          >
                            {item.search}
                            <span className="text-muted-foreground/80 ml-auto truncate group-aria-selected:block">
                              {formatDistanceToNow(item.timestamp, {
                                addSuffix: true,
                              })}
                            </span>
                            <button
                              type="button"
                              onMouseDown={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                              }}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setLastSearches(
                                  lastSearches.filter(
                                    (i) => i.search !== item.search,
                                  ),
                                );
                              }}
                              className="hover:bg-background ml-1 hidden rounded-md p-0.5 group-aria-selected:block"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </CommandItem>
                        );
                      })}
                  </CommandGroup>
                </>
              )}
            </CommandList>
            <div
              className="bg-accent/50 text-accent-foreground flex flex-wrap justify-between gap-2 border-t px-2 py-1.5 text-sm"
              cmdk-footer=""
            >
              <div className="flex flex-wrap gap-2">
                <span>
                  Use <Kbd>↑</Kbd> <Kbd>↓</Kbd> to navigate
                </span>
                <span>
                  <Kbd>Enter</Kbd> to query
                </span>
                <span>
                  <Kbd>Esc</Kbd> to close
                </span>
                <Separator
                  orientation="vertical"
                  className="my-auto data-[orientation=vertical]:h-3"
                />
                <span>
                  Union: <Kbd>regions:a,b</Kbd>
                </span>
                <span>
                  Range: <Kbd>p95:59-340</Kbd>
                </span>
                <span>
                  Spaces: <Kbd>name:&quot;a b&quot;</Kbd>
                </span>
                <Separator
                  orientation="vertical"
                  className="my-auto data-[orientation=vertical]:h-3"
                />
                <span>
                  AI:{" "}
                  <Kbd>
                    <Sparkles className="size-2.5 shrink-0" />
                  </Kbd>
                </span>
              </div>
              {lastSearches.length ? (
                <button
                  type="button"
                  className="text-muted-foreground hover:text-accent-foreground"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                  onClick={() => setLastSearches([])}
                >
                  Clear suggestions
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </Command>
    </div>
  );
}

function CommandItemSuggestions<TData>({
  field,
}: {
  field: DataTableFilterField<TData>;
}) {
  const { table, getFacetedMinMaxValues, getFacetedUniqueValues } =
    useDataTable();
  const value = field.value as string;
  switch (field.type) {
    case "checkbox": {
      return (
        <span className="text-muted-foreground/80 ml-1 hidden truncate group-aria-selected:block">
          {getFacetedUniqueValues
            ? Array.from(getFacetedUniqueValues(table, value)?.keys() || [])
                .map((value) => `[${value}]`)
                .join(" ")
            : field.options?.map(({ value }) => `[${value}]`).join(" ")}
        </span>
      );
    }
    case "slider": {
      const [min, max] = getFacetedMinMaxValues?.(table, value) || [
        field.min,
        field.max,
      ];
      return (
        <span className="text-muted-foreground/80 ml-1 hidden truncate group-aria-selected:block">
          [{min} - {max}]
        </span>
      );
    }
    case "input": {
      return (
        <span className="text-muted-foreground/80 ml-1 hidden truncate group-aria-selected:block">
          [{`${String(field.value)}`} input]
        </span>
      );
    }
    default: {
      return null;
    }
  }
}
