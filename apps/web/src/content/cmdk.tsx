"use client";

import {
  Loading,
  Search as SearchIcon,
  Close as XIcon,
} from "@openstatus/icons";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandLoading,
  CommandSeparator,
  CommandShortcut,
} from "@openstatus/ui/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@openstatus/ui/components/ui/dialog";
import { useDebounce } from "@openstatus/ui/hooks/use-debounce";
import { cn } from "@openstatus/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Command as CommandPrimitive } from "cmdk";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import * as React from "react";

import { CORPUS_LABELS, type Corpus, type SearchResult } from "./search-meta";
import { buildHighlightRegex } from "./utils/search-match";

type ConfigItem = {
  type: "item";
  label: string;
  href: string;
  shortcut?: string;
};

type ConfigGroup = {
  type: "group";
  label: string;
  heading: string;
  page: string;
};

type ConfigSection = {
  type: "group";
  heading: string;
  items: (ConfigItem | ConfigGroup)[];
};

const CONFIG: ConfigSection[] = [
  {
    type: "group",
    heading: "Resources",
    items: [
      {
        type: "item",
        label: "Go to Docs",
        href: "/docs",
        shortcut: "⌘D",
      },
      {
        type: "item",
        label: "Go to Home",
        href: "/",
        shortcut: "⌘H",
      },
      {
        type: "item",
        label: "Go to Pricing",
        href: "/pricing",
        shortcut: "⌘P",
      },
      {
        type: "item",
        label: "Go to Global Speed Checker",
        href: "/play/checker",
        shortcut: "⌘G",
      },
      {
        type: "group",
        label: "Search in all pages...",
        heading: "All pages",
        page: "all",
      },
      {
        type: "group",
        label: "Search in Docs...",
        heading: "Docs",
        page: "docs",
      },
      {
        type: "group",
        label: "Search in Products...",
        heading: "Products",
        page: "product",
      },
      {
        type: "group",
        label: "Search in Blog...",
        heading: "Blog",
        page: "blog",
      },
      {
        type: "group",
        label: "Search in Changelog...",
        heading: "Changelog",
        page: "changelog",
      },
      {
        type: "group",
        label: "Search in Tools...",
        heading: "Tools",
        page: "tools",
      },
      {
        type: "group",
        label: "Search in Tooling...",
        heading: "Tooling",
        page: "tooling",
      },
      {
        type: "group",
        label: "Search in Compare...",
        heading: "Compare",
        page: "compare",
      },
      {
        type: "group",
        label: "Search in Guides...",
        heading: "Guides",
        page: "guides",
      },
      {
        type: "group",
        label: "Search in Use Cases...",
        heading: "Use Cases",
        page: "use-case",
      },
      {
        type: "group",
        label: "Search in Customers...",
        heading: "Customers",
        page: "customers",
      },
      {
        type: "item",
        label: "Go to About",
        href: "/about",
      },
      {
        type: "item",
        label: "Book a call",
        href: "/cal",
      },
    ],
  },

  {
    type: "group",
    heading: "Community",
    items: [
      {
        type: "item",
        label: "Discord",
        href: "/discord",
      },
      {
        type: "item",
        label: "GitHub",
        href: "/github",
      },
      {
        type: "item",
        label: "X",
        href: "/twitter",
      },
      {
        type: "item",
        label: "BlueSky",
        href: "/bsky",
      },
      {
        type: "item",
        label: "YouTube",
        href: "/youtube",
      },
      {
        type: "item",
        label: "LinkedIn",
        href: "/linkedin",
      },
    ],
  },
];

export function CmdK({
  defaultPage,
  className,
}: { defaultPage?: string; className?: string } = {}) {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const resetTimerRef = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const [search, setSearch] = React.useState("");
  const [pages, setPages] = React.useState<string[]>(
    defaultPage ? [defaultPage] : [],
  );
  const debouncedSearch = useDebounce(search, 150);
  const query = debouncedSearch.trim();
  const router = useRouter();

  // Explicitly pinned corpus (e.g. "Search in Docs…" or the docs-page default).
  const page = pages.length > 0 ? pages[pages.length - 1] : null;
  // Typing with nothing pinned searches everything — no need to pick a corpus first.
  const scope: Corpus | "all" | null =
    (page as Corpus | null) ?? (search.trim() ? "all" : null);
  // Commands (Go to…, links, theme) stay matchable while typing, unless a corpus
  // is pinned — then the palette is focused on searching within that corpus.
  const showCommands = !page;

  const {
    data: items = [],
    isLoading: loading,
    isFetching: fetching,
  } = useQuery<SearchResult[]>({
    queryKey: ["search", scope, query],
    queryFn: async () => {
      if (!scope) return [];
      const searchParams = new URLSearchParams();
      searchParams.set("p", scope);
      if (query) searchParams.set("q", query);
      const res = await fetch(`/api/search?${searchParams.toString()}`);
      return res.json();
    },
    // A pinned corpus can browse with an empty query; unpinned "all" waits for input.
    enabled: !!page || !!query,
    placeholderData: (previousData) => previousData,
  });

  const resetSearch = React.useCallback(() => setSearch(""), []);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }

      // Handle shortcuts when dialog is open
      if (open && (e.metaKey || e.ctrlKey)) {
        const key = e.key.toLowerCase();

        // Find matching shortcut in CONFIG
        for (const section of CONFIG) {
          for (const item of section.items) {
            if (item.type === "item" && item.shortcut) {
              const shortcutKey = item.shortcut.replace("⌘", "").toLowerCase();
              if (key === shortcutKey) {
                e.preventDefault();
                router.push(item.href);
                setOpen(false);
                return;
              }
            }
          }
        }
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [open, router]);

  // NOTE: Reset search and pages after dialog closes (with delay for animation)
  // - if within 1 second of closing, the dialog will not reset
  React.useEffect(() => {
    const DELAY = 1000;

    if (!open && items.length > 0) {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
      resetTimerRef.current = setTimeout(() => {
        setSearch("");
        setPages(defaultPage ? [defaultPage] : []);
      }, DELAY);
    }

    if (open && resetTimerRef.current) {
      clearTimeout(resetTimerRef.current);
      resetTimerRef.current = undefined;
    }

    return () => {
      if (resetTimerRef.current) {
        clearTimeout(resetTimerRef.current);
      }
    };
  }, [open, items.length, defaultPage]);

  return (
    <>
      <button
        type="button"
        className={cn(
          "hover:bg-muted flex w-full items-center text-left",
          open && "bg-muted!",
          className,
        )}
        onClick={() => setOpen(true)}
      >
        <span className="text-muted-foreground truncate">
          SearchIcon<span className="text-xs">...</span>
        </span>
        <kbd className="bg-muted text-muted-foreground pointer-events-none ml-auto inline-flex h-5 items-center gap-1 border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="top-[15%] translate-y-0 overflow-hidden rounded-none p-0 font-mono shadow-2xl lg:max-w-2xl xl:max-w-3xl"
        >
          <DialogTitle className="sr-only">SearchIcon</DialogTitle>
          <Command
            onKeyDown={(e) => {
              // e.key === "Escape" ||
              if (e.key === "Backspace" && !search) {
                e.preventDefault();
                setPages((pages) => pages.slice(0, -1));
              }
            }}
            shouldFilter={false}
            className="rounded-none"
          >
            <div
              className="flex items-center gap-2 border-b px-3"
              cmdk-input-wrapper=""
            >
              {loading || fetching ? (
                <Loading className="h-4 w-4 shrink-0 animate-spin opacity-50" />
              ) : (
                <SearchIcon className="h-4 w-4 shrink-0 opacity-50" />
              )}
              {page ? (
                <span className="bg-muted text-muted-foreground inline-flex shrink-0 items-center gap-1 border px-1.5 py-0.5 text-xs">
                  {CORPUS_LABELS[page as Corpus] ?? page}
                  <button
                    type="button"
                    aria-label="Clear scope"
                    className="opacity-60 hover:opacity-100"
                    onClick={() => setPages([])}
                  >
                    <XIcon className="h-3 w-3" />
                  </button>
                </span>
              ) : scope === "all" ? (
                <span className="bg-muted text-muted-foreground inline-flex shrink-0 items-center border px-1.5 py-0.5 text-xs">
                  all
                </span>
              ) : null}
              <CommandPrimitive.Input
                ref={inputRef}
                className="placeholder:text-foreground-muted flex h-11 w-full rounded-none bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                placeholder={
                  page
                    ? `Search in ${CORPUS_LABELS[page as Corpus] ?? page}…`
                    : "Type to search…"
                }
                value={search}
                onValueChange={setSearch}
              />
            </div>
            <CommandList
              ref={listRef}
              className="max-h-[50vh] lg:max-h-[60vh] [&_[cmdk-item]]:rounded-none"
            >
              {(loading || fetching) && scope && !items.length ? (
                <CommandLoading>Searching...</CommandLoading>
              ) : null}
              {!(loading || fetching) ? (
                <CommandEmpty>No results found.</CommandEmpty>
              ) : null}
              {showCommands ? (
                <Home
                  search={search}
                  setPages={setPages}
                  resetSearch={resetSearch}
                  setOpen={setOpen}
                />
              ) : null}
              {scope && items.length > 0 ? (
                <SearchResults
                  items={items}
                  search={search}
                  setOpen={setOpen}
                  scope={scope}
                />
              ) : null}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Home({
  search,
  setPages,
  resetSearch,
  setOpen,
}: {
  search: string;
  setPages: React.Dispatch<React.SetStateAction<string[]>>;
  resetSearch: () => void;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  const matches = (label: string) =>
    !search || label.toLowerCase().includes(search.toLowerCase());

  const themeLabel = `Switch to ${resolvedTheme === "dark" ? "light" : "dark"} theme`;

  // Build the visible sections up front so separators only sit between
  // sections that actually render (no leading/trailing/doubled dividers).
  const sections = CONFIG.map((group) => ({
    heading: group.heading,
    items: group.items.filter((item) => matches(item.label)),
  })).filter((section) => section.items.length > 0);

  if (matches(themeLabel)) {
    sections.push({ heading: "Settings", items: [] });
  }

  return (
    <>
      {sections.map((section, index) => (
        <React.Fragment key={section.heading}>
          {index > 0 && <CommandSeparator />}
          <CommandGroup heading={section.heading}>
            {section.heading === "Settings" ? (
              <CommandItem
                onSelect={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
              >
                <span>{themeLabel}</span>
              </CommandItem>
            ) : (
              section.items.map((item) => {
                if (item.type === "item") {
                  return (
                    <CommandItem
                      key={item.label}
                      value={item.label}
                      onSelect={() => {
                        router.push(item.href);
                        setOpen(false);
                      }}
                    >
                      <span>{item.label}</span>
                      {item.shortcut && (
                        <CommandShortcut>{item.shortcut}</CommandShortcut>
                      )}
                    </CommandItem>
                  );
                }
                return (
                  <CommandItem
                    key={item.page}
                    value={item.label}
                    onSelect={() => {
                      setPages((pages) => [...pages, item.page]);
                      resetSearch();
                    }}
                  >
                    <span>{item.label}</span>
                  </CommandItem>
                );
              })
            )}
          </CommandGroup>
        </React.Fragment>
      ))}
    </>
  );
}

// Bucket, preserving the server's rank order — first key seen is the best-scoring one.
function bucket<K>(list: SearchResult[], keyOf: (item: SearchResult) => K) {
  const groups: { key: K; items: SearchResult[] }[] = [];
  const map = new Map<K, SearchResult[]>();
  for (const item of list) {
    const key = keyOf(item);
    let b = map.get(key);
    if (!b) {
      b = [];
      map.set(key, b);
      groups.push({ key, items: b });
    }
    b.push(item);
  }
  return groups;
}

function SearchResults({
  items,
  search,
  setOpen,
  scope,
}: {
  items: SearchResult[];
  search: string;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  scope: Corpus | "all";
}) {
  const router = useRouter();

  const highlightRe = React.useMemo(
    () => buildHighlightRegex(search),
    [search],
  );
  const highlight = (text: string) =>
    highlightRe
      ? text.replace(highlightRe, (match) => `<mark>${match}</mark>`)
      : text;

  const renderRow = (item: SearchResult) => (
    <CommandItem
      key={item.href}
      value={item.href}
      onSelect={() => {
        router.push(item.href);
        setOpen(false);
      }}
    >
      <div className="grid min-w-0">
        <span
          className="block truncate"
          // oxlint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{ __html: highlight(item.metadata.title) }}
        />
        {item.content && search ? (
          <span
            className="text-muted-foreground block truncate text-xs"
            // oxlint-disable-next-line react/no-danger
            dangerouslySetInnerHTML={{ __html: highlight(item.content) }}
          />
        ) : null}
      </div>
    </CommandItem>
  );

  // Split full vs partial matches, then sub-group each tier: by corpus in "all"
  // scope (kept flat — no category level), by category within a single corpus.
  const keyOf: (item: SearchResult) => string =
    scope === "all"
      ? (item) => CORPUS_LABELS[item.type]
      : (item) => item.metadata.category || CORPUS_LABELS[item.type];

  const full = bucket(
    items.filter((i) => i.tier !== "partial"),
    keyOf,
  );
  const partial = bucket(
    items.filter((i) => i.tier === "partial"),
    keyOf,
  );

  const renderGroups = (
    groups: { key: string; items: SearchResult[] }[],
    prefix: string,
  ) =>
    groups.map((group, index) => (
      <React.Fragment key={`${prefix}-${group.key}`}>
        {index > 0 && <CommandSeparator />}
        <CommandGroup heading={group.key}>
          {group.items.map(renderRow)}
        </CommandGroup>
      </React.Fragment>
    ));

  return (
    <>
      {renderGroups(full, "full")}
      {partial.length > 0 ? renderGroups(partial, "partial") : null}
    </>
  );
}
