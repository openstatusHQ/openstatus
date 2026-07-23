"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandLoading,
} from "@openstatus/ui/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@openstatus/ui/components/ui/dialog";
import { useQuery } from "@tanstack/react-query";
import { Command as CommandPrimitive } from "cmdk";
import { Moon, Search, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import * as React from "react";

import { FormSheetMaintenanceCreate } from "@/components/forms/maintenance/sheet-create";
import { FormSheetStatusReportCreate } from "@/components/forms/status-report/sheet-create";
import { FormDialogSupportContact } from "@/components/forms/support-contact/dialog";
import { scrollToHash, useScrollToHash } from "@/hooks/use-scroll-to-hash";
import { useTRPC } from "@/lib/trpc/client";
import { switchWorkspace } from "@/lib/workspace-cookie";

import {
  type CommandLink,
  type CommandPage,
  type CommandSheetAction,
  CREATE_ACTIONS,
  CREATE_LINKS,
  HELP_LINK_ITEMS,
  HELP_SUPPORT_ACTION,
  MONITOR_ACTIONS,
  NAVIGATION,
  SETTINGS,
  STATUS_PAGE_ACTIONS,
} from "./config";
import { useCommandMenu } from "./provider";

type ActiveSheet = CommandSheetAction["sheet"] | null;

const IDLE_CAP = 5;

function LinkItem({
  item,
  onSelect,
}: {
  item: CommandLink;
  onSelect: (item: CommandLink) => void;
}) {
  return (
    <CommandItem
      value={item.label}
      keywords={item.keywords}
      onSelect={() => onSelect(item)}
    >
      <item.icon />
      <span>{item.label}</span>
    </CommandItem>
  );
}

function ActionItem({
  action,
  onSelect,
}: {
  action: CommandSheetAction;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      value={action.label}
      keywords={action.keywords}
      onSelect={onSelect}
    >
      <action.icon />
      <span>{action.label}</span>
    </CommandItem>
  );
}

export function CommandMenu() {
  const { open, setOpen } = useCommandMenu();
  const [search, setSearch] = React.useState("");
  const [pages, setPages] = React.useState<CommandPage[]>([]);
  const [activeSheet, setActiveSheet] = React.useState<ActiveSheet>(null);
  const [mounted, setMounted] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const trpc = useTRPC();

  useScrollToHash();

  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());
  const { data: statusPages } = useQuery(trpc.page.list.queryOptions());
  const { data: workspaces } = useQuery(trpc.workspace.list.queryOptions());
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());

  const page = pages.length > 0 ? pages[pages.length - 1] : null;

  React.useEffect(() => setMounted(true), []);

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, [setOpen]);

  // Reset scope + query every time the palette opens.
  React.useEffect(() => {
    if (open) {
      setSearch("");
      setPages([]);
    }
  }, [open]);

  const pop = React.useCallback(() => {
    setPages((prev) => prev.slice(0, -1));
    setSearch("");
  }, []);

  const pushPage = (next: CommandPage) => {
    setPages((prev) => [...prev, next]);
    setSearch("");
  };

  const navigate = (href: string) => {
    router.push(href);
    setOpen(false);
    const hashIndex = href.indexOf("#");
    if (hashIndex !== -1) scrollToHash(href.slice(hashIndex + 1));
  };

  const selectLink = (item: CommandLink) => {
    if (item.external) {
      window.open(item.href, "_blank", "noreferrer");
      setOpen(false);
      return;
    }
    navigate(item.href);
  };

  const openSheet = (sheet: Exclude<ActiveSheet, null>) => {
    setOpen(false);
    // Defer so the palette Dialog releases focus + scroll lock before the
    // sheet/dialog claims them — otherwise Radix layers fight during overlap.
    setTimeout(() => setActiveSheet(sheet), 0);
  };

  const idleCap = <T,>(items: T[]) =>
    search ? items : items.slice(0, IDLE_CAP);

  const otherWorkspaces =
    workspaces?.filter((w) => w.slug !== workspace?.slug) ?? [];

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            inputRef.current?.focus();
          }}
          className="top-[15%] translate-y-0 overflow-hidden p-0 lg:max-w-xl"
        >
          <DialogTitle className="sr-only">Command Menu</DialogTitle>
          <Command
            onKeyDown={(e) => {
              if (e.key === "Backspace" && !search && pages.length > 0) {
                e.preventDefault();
                pop();
              }
            }}
          >
            <div
              className="flex items-center gap-2 border-b px-3"
              cmdk-input-wrapper=""
            >
              <Search className="size-4 shrink-0 opacity-50" />
              {page ? (
                <span className="bg-muted text-muted-foreground inline-flex shrink-0 items-center gap-1 rounded border px-1.5 py-0.5 text-xs">
                  {page.type === "monitor" ? page.name : page.title}
                  <button
                    type="button"
                    aria-label="Clear scope"
                    className="opacity-60 hover:opacity-100"
                    onClick={pop}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ) : null}
              <CommandPrimitive.Input
                ref={inputRef}
                value={search}
                onValueChange={setSearch}
                placeholder={
                  page ? "Search actions…" : "Type a command or search…"
                }
                className="placeholder:text-muted-foreground flex h-10 w-full bg-transparent py-3 text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
            <CommandList>
              <CommandEmpty>No results found.</CommandEmpty>

              {page ? (
                <CommandGroup
                  heading={page.type === "monitor" ? page.name : page.title}
                >
                  {(page.type === "monitor"
                    ? MONITOR_ACTIONS(page.id)
                    : STATUS_PAGE_ACTIONS(page.id)
                  ).map((item) => (
                    <CommandItem
                      key={item.href}
                      value={item.label}
                      keywords={item.keywords}
                      onSelect={() => navigate(item.href)}
                    >
                      <item.icon />
                      <span>{item.label}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              ) : (
                <>
                  {monitors === undefined ? (
                    <CommandLoading>Loading…</CommandLoading>
                  ) : null}

                  {monitors && monitors.length > 0 ? (
                    <CommandGroup heading="Monitors">
                      {idleCap(monitors).map((m) => (
                        <CommandItem
                          key={m.id}
                          value={`monitor-${m.id}`}
                          keywords={[m.name, m.url]}
                          onSelect={() =>
                            pushPage({
                              type: "monitor",
                              id: m.id,
                              name: m.name,
                            })
                          }
                        >
                          <div className="grid min-w-0">
                            <span className="truncate">{m.name}</span>
                            <span className="text-muted-foreground truncate text-xs">
                              {m.url}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}

                  {statusPages && statusPages.length > 0 ? (
                    <CommandGroup heading="Status Pages">
                      {idleCap(statusPages).map((p) => (
                        <CommandItem
                          key={p.id}
                          value={`status-page-${p.id}`}
                          keywords={[p.title, p.slug, p.customDomain].filter(
                            Boolean,
                          )}
                          onSelect={() =>
                            pushPage({
                              type: "status-page",
                              id: p.id,
                              title: p.title,
                            })
                          }
                        >
                          <div className="grid min-w-0">
                            <span className="truncate">{p.title}</span>
                            <span className="text-muted-foreground truncate text-xs">
                              {p.slug}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}

                  <CommandGroup heading="Navigation">
                    {NAVIGATION.map((item) => (
                      <LinkItem
                        key={item.href}
                        item={item}
                        onSelect={selectLink}
                      />
                    ))}
                  </CommandGroup>

                  <CommandGroup heading="Create">
                    {CREATE_LINKS.map((item) => (
                      <LinkItem
                        key={item.href}
                        item={item}
                        onSelect={selectLink}
                      />
                    ))}
                    {CREATE_ACTIONS.map((action) => (
                      <ActionItem
                        key={action.sheet}
                        action={action}
                        onSelect={() => openSheet(action.sheet)}
                      />
                    ))}
                  </CommandGroup>

                  <CommandGroup heading="Settings">
                    {SETTINGS.map((item) => (
                      <LinkItem
                        key={item.href}
                        item={item}
                        onSelect={selectLink}
                      />
                    ))}
                  </CommandGroup>

                  {otherWorkspaces.length > 0 ? (
                    <CommandGroup heading="Workspace">
                      {otherWorkspaces.map((w) => (
                        <CommandItem
                          key={w.id}
                          value={`workspace-${w.id}`}
                          keywords={[w.name || "Untitled Workspace", w.slug]}
                          onSelect={() => switchWorkspace(w.slug)}
                        >
                          <span className="truncate">
                            {w.name || "Untitled Workspace"}
                          </span>
                          <span className="text-muted-foreground truncate font-mono text-xs">
                            {w.slug}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}

                  <CommandGroup heading="Get Help">
                    <ActionItem
                      action={HELP_SUPPORT_ACTION}
                      onSelect={() => openSheet("support")}
                    />
                    {HELP_LINK_ITEMS.map((item) => (
                      <LinkItem
                        key={item.href}
                        item={item}
                        onSelect={selectLink}
                      />
                    ))}
                  </CommandGroup>

                  {mounted ? (
                    <CommandGroup heading="Theme">
                      <CommandItem
                        value="toggle-theme"
                        keywords={["dark", "light", "appearance"]}
                        onSelect={() =>
                          setTheme(resolvedTheme === "dark" ? "light" : "dark")
                        }
                      >
                        {resolvedTheme === "dark" ? <Sun /> : <Moon />}
                        <span>
                          Switch to{" "}
                          {resolvedTheme === "dark" ? "light" : "dark"} theme
                        </span>
                      </CommandItem>
                    </CommandGroup>
                  ) : null}
                </>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>

      <FormSheetStatusReportCreate
        open={activeSheet === "status-report"}
        onOpenChange={(o) => setActiveSheet(o ? "status-report" : null)}
      />
      <FormSheetMaintenanceCreate
        open={activeSheet === "maintenance"}
        onOpenChange={(o) => setActiveSheet(o ? "maintenance" : null)}
      />
      <FormDialogSupportContact
        open={activeSheet === "support"}
        onOpenChange={(o) => setActiveSheet(o ? "support" : null)}
      />
    </>
  );
}
