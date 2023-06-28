"use client";

import * as React from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Command as CommandPrimitive, useCommandState } from "cmdk";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export function InputSearch({
  events,
}: {
  // FIXME: should be return type
  events: {
    id: string;
    timestamp: number;
    statusCode: number;
    latency: number;
    url: string;
  }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [open, setOpen] = React.useState<boolean>(false);
  const [inputValue, setInputValue] = React.useState<string>("");
  const [currentWord, setCurrentWord] = React.useState("");

  // Create query string
  const createQueryString = React.useCallback(
    (params: Record<string, string | number | null>) => {
      const newSearchParams = new URLSearchParams(searchParams?.toString());

      for (const [key, value] of Object.entries(params)) {
        if (value === null) {
          newSearchParams.delete(key);
        } else {
          newSearchParams.set(key, String(value));
        }
      }
      return newSearchParams.toString();
    },
    [searchParams]
  );

  React.useEffect(() => {
    // FIXME: remove search params if exists on page load
    const queryParams = createQueryString({
      limit: null,
      status: null,
      pathname: null,
    });
    startTransition(() => {
      router.replace(`${pathname}?${queryParams}`);
    });
  }, [router]);

  React.useEffect(() => {
    const searchparams = inputValue
      .trim()
      .split(" ")
      .reduce((prev, curr) => {
        const [name, value] = curr.split(":");
        if (value && name && curr !== currentWord) {
          if (value.includes(",")) {
            // const values = value.split(",") // TODO: support multiple value
          }
          prev[name] = value;
        }
        return prev;
      }, {} as Record<string, string>);
    // console.log(searchparams);
    startTransition(() => {
      router.push(`${pathname}?${createQueryString(searchparams)}`);
    });
  }, [inputValue]);

  // TODO: once stable, use the shallow route to store the search params inside of the search params

  // DEFINE YOUR SEARCH PARAMETERS
  const search = React.useMemo(
    () =>
      events.reduce(
        (prev, curr) => {
          const { pathname } = new URL(curr.url);
          return {
            ...prev,
            status: [...new Set([curr.statusCode, ...(prev.status || [])])],
            pathname: [...new Set([pathname, ...(prev.pathname || [])])],
          };
        },
        // defaultState
        { limit: [10, 25, 50], status: [], pathname: [] } as {
          status: number[];
          limit: number[];
          pathname: string[];
        }
      ),
    [events]
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
        className="flex-1 rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none ring-offset-background placeholder:text-muted-foreground focus:ring-2 focus:ring-ring focus:ring-offset-2"
      />
      <div className="relative mt-2">
        {open ? (
          <div className="z-10 absolute top-0 w-full rounded-md border bg-popover text-popover-foreground shadow-md outline-none animate-in">
            <CommandGroup className="h-full overflow-auto">
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
                          const input = prev.replace(
                            ` ${currentWord}`,
                            ` ${value}`
                          );
                          return `${input}:`;
                        });
                        setCurrentWord(`${value}:`);
                      }}
                      className="group"
                    >
                      {key}
                      <span className="ml-1 hidden truncate text-muted-foreground group-aria-[selected=true]:block">
                        [{search[key as SearchKey].join(", ")}]
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
