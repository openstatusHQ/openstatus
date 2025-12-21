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
import { useRouter } from "next/navigation";

type ConfigItem = {
  type: "item";
  label: string;
  href: string;
  shortcut?: string;
};

type ConfigGroup = {
  type: "group";
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
        type: "item",
        label: "Pricing",
        href: "/pricing",
      },
      {
        type: "item",
        label: "Docs",
        href: "https://docs.openstatus.dev",
      },
      {
        type: "group",
        heading: "Blog",
        page: "blog",
        query: {
          q: "search",
          p: "page",
        },
      },
      {
        type: "group",
        heading: "Changelog",
        page: "changelog",
        query: {
          q: "search",
          p: "page",
        },
      },
      {
        type: "item",
        label: "Global Speed Checker",
        href: "/play/checker",
        shortcut: "⌘G",
      },
      {
        type: "group",
        heading: "Tools",
        page: "tools",
        query: {
          q: "search",
          p: "page",
        },
      },
      {
        type: "group",
        heading: "Compare",
        page: "compare",
        query: {
          q: "search",
          p: "page",
        },
      },
    ],
  },
  {
    type: "group",
    heading: "Products",
    items: [
      {
        type: "item",
        label: "Monitoring as Code",
        href: "/monitoring-as-code",
        shortcut: "⌘M",
      },
      {
        type: "item",
        label: "Private Locations",
        href: "/private-locations",
        shortcut: "⌘L",
      },
      {
        type: "item",
        label: "Status Page",
        href: "/status-page",
        shortcut: "⌘S",
      },
      {
        type: "item",
        label: "Uptime Monitoring",
        href: "/uptime-monitoring",
        shortcut: "⌘U",
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
  const [items, setItems] = React.useState<MDXData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const debouncedSearch = useDebounce(search, 300);
  const router = useRouter();

  const page = pages.length > 0 ? pages[pages.length - 1] : null;

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

  // TODO: add debounce search
  // TODO: replace "t" with "p" (p for page)

  React.useEffect(() => {
    if (!page) return;
    setLoading(true);
    fetch(`/api/search?p=${page}&q=${debouncedSearch}`)
      .then((res) => res.json())
      .then((data) => setItems(data))
      .finally(() => setLoading(false));
  }, [page, debouncedSearch]);

  return (
    <>
      <p className="text-muted-foreground text-sm">
        Press{" "}
        <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-1 rounded border px-1.5 font-mono text-[10px] font-medium opacity-100 select-none">
          <span className="text-xs">⌘</span>K
        </kbd>
      </p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 shadow-2xl font-mono rounded-none">
          <DialogTitle className="sr-only">Search</DialogTitle>
          <Command
            onKeyDown={(e) => {
              if (e.key === "Escape" || (e.key === "Backspace" && !search)) {
                e.preventDefault();
                setPages((pages) => pages.slice(0, -1));
                setItems([]);
              }
            }}
          >
            {pages.length > 0 ? (
              <div className="px-2 pt-1.5">
                {pages.map((p, index) => {
                  return (
                    <React.Fragment key={p}>
                      <div
                        cmdk-openstatus-badge=""
                        className="text-[10px] text-muted-foreground"
                      >
                        {p}
                      </div>
                      {index < pages.length - 1 ? <span>|</span> : null}
                    </React.Fragment>
                  );
                })}
              </div>
            ) : null}
            <CommandInput
              placeholder="Type a command or search..."
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
                    key={item.heading}
                    onSelect={() => {
                      setPages((pages) => [...pages, item.page]);
                      resetSearch();
                    }}
                  >
                    <span>{item.heading}</span>
                  </CommandItem>
                );
              }
              return null;
            })}
          </CommandGroup>
        </React.Fragment>
      ))}
    </>
  );
}

function SearchResults({
  items,
  search,
  setOpen,
}: {
  items: MDXData[];
  search: string;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const router = useRouter();

  return (
    <CommandGroup>
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
            onSelect={() => {
              router.push(item.href);
              setOpen(false);
            }}
          >
            <div className="min-w-0 grid">
              <span
                className="truncate block"
                dangerouslySetInnerHTML={{ __html: title }}
              />
              {item.content && search ? (
                <span
                  className="block text-muted-foreground text-xs truncate"
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
