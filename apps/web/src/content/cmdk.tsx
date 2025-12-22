"use client";

import * as React from "react";

import { Kbd } from "@/components/kbd";
import type { MDXData } from "@/content/utils";
import { useDebounce } from "@/hooks/use-debounce";
import { cn } from "@/lib/utils";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandLoading,
  CommandSeparator,
  CommandShortcut,
  Dialog,
  DialogContent,
  DialogTitle,
} from "@openstatus/ui";
import { useQuery } from "@tanstack/react-query";
import { Command as CommandPrimitive } from "cmdk";
import { Loader2, Search } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";

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

// TODO: missing shortcuts
const CONFIG: ConfigSection[] = [
  {
    type: "group",
    heading: "Resources",
    items: [
      {
        type: "group",
        label: "Search in Products...",
        heading: "Products",
        page: "product",
      },
      {
        type: "item",
        label: "Go to Pricing",
        href: "/pricing",
      },
      {
        type: "item",
        label: "Go to Docs",
        href: "https://docs.openstatus.dev",
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
        type: "item",
        label: "Go to Global Speed Checker",
        href: "/play/checker",
        shortcut: "⌘G",
      },
      {
        type: "group",
        label: "Search in Tools...",
        heading: "Tools",
        page: "tools",
      },
      {
        type: "group",
        label: "Search in Compare...",
        heading: "Compare",
        page: "compare",
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
        href: "/x",
      },
      {
        type: "item",
        label: "BlueSky",
        href: "/bluesky",
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

export function CmdK() {
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const resetTimerRef = React.useRef<NodeJS.Timeout | undefined>(undefined);
  const [search, setSearch] = React.useState("");
  const [pages, setPages] = React.useState<string[]>([]);
  const debouncedSearch = useDebounce(search, 300);
  const router = useRouter();

  const page = pages.length > 0 ? pages[pages.length - 1] : null;

  const {
    data: items = [],
    isLoading: loading,
    isFetching: fetching,
  } = useQuery({
    queryKey: ["search", page, debouncedSearch],
    queryFn: async () => {
      if (!page) return [];
      const res = await fetch(`/api/search?p=${page}&q=${debouncedSearch}`);
      return res.json();
    },
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

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
        setPages([]);
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
  }, [open, items.length]);

  console.log({ loading, fetching });

  return (
    <>
      <button
        type="button"
        className={cn("p-4 hover:bg-muted", open && "bg-muted!")}
        onClick={() => setOpen(true)}
      >
        <span className="sr-only">Press</span>
        <Kbd variant="outline">⌘K</Kbd>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden rounded-none p-0 font-mono shadow-2xl">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <Command
            onKeyDown={(e) => {
              // e.key === "Escape" ||
              if (e.key === "Backspace" && !search) {
                e.preventDefault();
                setPages((pages) => pages.slice(0, -1));
              }
            }}
            shouldFilter={!page}
            className="rounded-none"
          >
            <div
              className="flex items-center border-b px-3"
              cmdk-input-wrapper=""
            >
              {loading || fetching ? (
                <Loader2 className="mr-2 h-4 w-4 shrink-0 opacity-50 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
              )}
              <CommandPrimitive.Input
                className="placeholder:text-foreground-muted flex h-11 w-full rounded-none bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Type to search…"
                value={search}
                onValueChange={setSearch}
              />
            </div>
            <CommandList ref={listRef} className="[&_[cmdk-item]]:rounded-none">
              <CommandEmpty>No results found.</CommandEmpty>
              {loading && !items.length ? (
                <CommandLoading>Searching...</CommandLoading>
              ) : null}
              {!page ? (
                <Home
                  setPages={setPages}
                  resetSearch={resetSearch}
                  setOpen={setOpen}
                />
              ) : null}
              {items.length > 0 ? (
                <SearchResults
                  items={items}
                  search={search}
                  setOpen={setOpen}
                  page={page}
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
  setPages,
  resetSearch,
  setOpen,
}: {
  setPages: React.Dispatch<React.SetStateAction<string[]>>;
  resetSearch: () => void;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <>
      {CONFIG.map((group, groupIndex) => (
        <React.Fragment key={group.heading}>
          {groupIndex > 0 && <CommandSeparator />}
          <CommandGroup heading={group.heading}>
            {group.items.map((item) => {
              if (item.type === "item") {
                return (
                  <CommandItem
                    key={item.label}
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
              if (item.type === "group") {
                return (
                  <CommandItem
                    key={item.page}
                    onSelect={() => {
                      setPages((pages) => [...pages, item.page]);
                      resetSearch();
                    }}
                  >
                    <span>{item.label}</span>
                  </CommandItem>
                );
              }
              return null;
            })}
          </CommandGroup>
        </React.Fragment>
      ))}
      <CommandSeparator />
      <CommandGroup heading="Settings">
        <CommandItem
          onSelect={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          <span>
            Switch to {resolvedTheme === "dark" ? "light" : "dark"} theme
          </span>
        </CommandItem>
      </CommandGroup>
    </>
  );
}

function SearchResults({
  items,
  search,
  setOpen,
  page,
}: {
  items: MDXData[];
  search: string;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  page: string | null;
}) {
  const router = useRouter();

  const _page = CONFIG[0].items.find(
    (item) => item.type === "group" && item.page === page,
  ) as ConfigGroup | undefined;

  return (
    <CommandGroup heading={_page?.heading}>
      {items.map((item) => {
        // Highlight search term match in the title, case-insensitive
        const title = item.metadata.title.replace(
          new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
          (match) => `<mark>${match}</mark>`,
        );
        const html = item.content.replace(
          new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
          (match) => `<mark>${match}</mark>`,
        );

        return (
          <CommandItem
            key={item.slug}
            keywords={[item.metadata.title, item.content, search]}
            onSelect={() => {
              router.push(item.href);
              setOpen(false);
            }}
          >
            <div className="grid min-w-0">
              <span
                className="block truncate"
                // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
                dangerouslySetInnerHTML={{ __html: title }}
              />
              {item.content && search ? (
                <span
                  className="block truncate text-muted-foreground text-xs"
                  // biome-ignore lint/security/noDangerouslySetInnerHtml: <explanation>
                  dangerouslySetInnerHTML={{ __html: html }}
                />
              ) : null}
            </div>
          </CommandItem>
        );
      })}
    </CommandGroup>
  );
}
