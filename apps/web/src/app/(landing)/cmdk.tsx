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
import Link from "next/link";

// TODO: create config

// First search: static from the groups
// Second search: dynamic from the API

// TODO: missing shortcuts
const CONFIG = [
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
          // c: "category",
        },
      },
      {
        type: "group",
        heading: "Changelog",
        page: "changelog",
        query: {
          q: "search",
          p: "page",
          // c: "category",
        },
      },
      {
        type: "item",
        label: "Global Speed Checker",
        href: "/play/checker",
      },
      {
        type: "group",
        heading: "Tools",
        page: "tools",
        query: {
          q: "search",
          p: "page",
          // c: "category",
        },
      },
      {
        type: "group",
        heading: "Compare",
        page: "compare",
        query: {
          q: "search",
          p: "page",
          // c: "category",
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
      },
      {
        type: "item",
        label: "Private Locations",
        href: "/private-locations",
      },
      {
        type: "item",
        label: "Status Page",
        href: "/status-page",
      },
      {
        type: "item",
        label: "Uptime Monitoring",
        href: "/uptime-monitoring",
      },
    ],
  },
  {
    type: "group",
    heading: "Categories",
    items: [
      {
        type: "item",
        label: "Monitoring",
        href: "/monitoring",
      },
      {
        type: "item",
        label: "Company",
        href: "/company",
      },
      {
        type: "item",
        label: "Engineering",
        href: "/engineering",
      },
      {
        type: "item",
        label: "Education",
        href: "/education",
      },
      {
        type: "item",
        label: "Incidents",
        href: "/incidents",
      },
      {
        type: "item",
        label: "Cli",
        href: "/cli",
      },
      {
        type: "item",
        label: "Tools",
        href: "/tools",
      },
      {
        type: "item",
        label: "Notifications",
        href: "/notifications",
      },
      {
        type: "item",
        label: "Integrations",
        href: "/integrations",
      },
      {
        type: "item",
        label: "Statuspage",
        href: "/statuspage",
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
  //
  const [open, setOpen] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const listRef = React.useRef<HTMLDivElement | null>(null);
  const [search, setSearch] = React.useState("");
  const [pages, setPages] = React.useState<string[]>([]);
  const [items, setItems] = React.useState<MDXData[]>([]);
  const [loading, setLoading] = React.useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const page = pages.length > 0 ? pages[pages.length - 1] : null;

  const resetSearch = React.useCallback(() => setSearch(""), []);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };

    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  React.useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // TODO: add debounce search
  // TODO: replace "t" with "p" (p for page)

  React.useEffect(() => {
    if (!page) return;
    setLoading(true);
    fetch(`/api/search?t=${page}&q=${debouncedSearch}`)
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
                <Home setPages={setPages} resetSearch={resetSearch} />
              ) : null}
              {items.length > 0 ? (
                <CommandGroup>
                  {items.map((item) => {
                    // Highlight search term match in the title, case-insensitive
                    const title = item.metadata.title.replace(
                      new RegExp(
                        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                        "i",
                      ),
                      (match) => `<mark>${match}</mark>`,
                    );
                    const html = item.content.replace(
                      new RegExp(
                        search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                        "i",
                      ),
                      (match) => `<mark>${match}</mark>`,
                    );

                    return (
                      <CommandItem key={item.slug} asChild>
                        <Link href={`/${item.slug}`} className="min-w-0 grid">
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
                        </Link>
                      </CommandItem>
                    );
                  })}
                </CommandGroup>
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
}: {
  setPages: React.Dispatch<React.SetStateAction<string[]>>;
  resetSearch: () => void;
}) {
  return (
    <>
      <CommandGroup heading="Resources">
        <CommandItem asChild>
          <Link href="/pricing">Pricing</Link>
        </CommandItem>
        <CommandItem asChild>
          <Link href="/docs">Docs</Link>
        </CommandItem>
        <CommandItem
          onSelect={() => {
            setPages((pages) => [...pages, "blog"]);
            resetSearch();
          }}
        >
          <span>Blog</span>
        </CommandItem>
        <CommandItem
          onSelect={() => {
            setPages((pages) => [...pages, "changelog"]);
            resetSearch();
          }}
        >
          <span>Changelog</span>
        </CommandItem>
        <CommandItem asChild>
          <Link href="/play/checker">Global Speed Checker</Link>
        </CommandItem>
        <CommandItem
          onSelect={() => {
            setPages((pages) => [...pages, "tools"]);
            resetSearch();
          }}
        >
          <span>Playground (Tools)</span>
        </CommandItem>
        <CommandItem
          onSelect={() => {
            setPages((pages) => [...pages, "compare"]);
            resetSearch();
          }}
        >
          <span>Compare (Alternatives)</span>
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      <CommandGroup heading="Products">
        <CommandItem>
          <span>Monitoring as Code</span>
          <CommandShortcut>⌘P</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <span>Private Locations</span>
          <CommandShortcut>⌘B</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <span>Status Page</span>
          <CommandShortcut>⌘S</CommandShortcut>
        </CommandItem>
        <CommandItem>
          <span>Uptime Monitoring</span>
          <CommandShortcut>⌘S</CommandShortcut>
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      {/* TODO: automatically generate categories from the pages */}
      <CommandGroup heading="Categories">
        <CommandItem keywords={["category", "monitoring"]}>
          <span>Monitoring</span>
        </CommandItem>
        <CommandItem keywords={["category", "company"]}>
          <span>Company</span>
        </CommandItem>
        <CommandItem keywords={["category", "engineering"]}>
          <span>Engineering</span>
        </CommandItem>
        <CommandItem keywords={["category", "education"]}>
          <span>Education</span>
        </CommandItem>
        <CommandItem keywords={["category", "incidents"]}>
          <span>Incidents</span>
        </CommandItem>
        <CommandItem keywords={["category", "cli"]}>
          <span>Cli</span>
        </CommandItem>
        <CommandItem keywords={["category", "tools"]}>
          <span>Tools</span>
        </CommandItem>
        <CommandItem keywords={["category", "notifications"]}>
          <span>Notifications</span>
        </CommandItem>
        <CommandItem keywords={["category", "integrations"]}>
          <span>Integrations</span>
        </CommandItem>
        <CommandItem keywords={["category", "statuspage"]}>
          <span>Statuspage</span>
        </CommandItem>
      </CommandGroup>
      <CommandSeparator />
      {/* TODO: extract community */}
      <CommandGroup heading="Community">
        <CommandItem keywords={["community", "discord"]}>
          <span>Discord</span>
        </CommandItem>
        <CommandItem keywords={["community", "github"]}>
          <span>GitHub</span>
        </CommandItem>
        <CommandItem keywords={["community", "x"]}>
          <span>X</span>
        </CommandItem>
        <CommandItem keywords={["community", "bluesky"]}>
          <span>BlueSky</span>
        </CommandItem>
        <CommandItem keywords={["community", "youtube"]}>
          <span>YouTube</span>
        </CommandItem>
        <CommandItem keywords={["community", "linkedin"]}>
          <span>LinkedIn</span>
        </CommandItem>
      </CommandGroup>
    </>
  );
}
