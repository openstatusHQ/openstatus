"use client";

import * as React from "react";

import type { MDXData } from "@/content/utils";
import { useDebounce } from "@/hooks/use-debounce";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
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
  query: {
    q: string;
    p: string;
  };
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
        query: {
          q: "search",
          p: "page",
        },
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
        query: {
          q: "search",
          p: "page",
        },
      },
      {
        type: "group",
        label: "Search in Changelog...",
        heading: "Changelog",
        page: "changelog",
        query: {
          q: "search",
          p: "page",
        },
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
        query: {
          q: "search",
          p: "page",
        },
      },
      {
        type: "group",
        label: "Search in Compare...",
        heading: "Compare",
        page: "compare",
        query: {
          q: "search",
          p: "page",
        },
      },
      {
        type: "item",
        label: "Go to About",
        href: "/about",
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
  const [search, setSearch] = React.useState("");
  const [pages, setPages] = React.useState<string[]>([]);
  const debouncedSearch = useDebounce(search, 300);
  const router = useRouter();

  const page = pages.length > 0 ? pages[pages.length - 1] : null;

  const { data: items = [], isLoading: loading } = useQuery({
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

  //   NOTE: If we reset, we should add a setTimeout for the animation to hide the dialog
  //   React.useEffect(() => {
  //     if (!open && items.length > 0) {
  //       setItems([]);
  //       setSearch("");
  //       setPages([]);
  //     }
  //   }, [open]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="overflow-hidden rounded-none p-0 font-mono shadow-2xl">
        <DialogTitle className="sr-only">Search</DialogTitle>
        <Command
          onKeyDown={(e) => {
            if (e.key === "Escape" || (e.key === "Backspace" && !search)) {
              e.preventDefault();
              setPages((pages) => pages.slice(0, -1));
            }
          }}
          shouldFilter={!page}
          className="rounded-none"
        >
          <CommandInput
            placeholder="Type to search…"
            className="rounded-none"
            value={search}
            onValueChange={setSearch}
          />
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
