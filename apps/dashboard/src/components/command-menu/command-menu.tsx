"use client";

import { Close, Dark, Light, Search } from "@openstatus/icons";
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
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import * as React from "react";

import { FormSheetMaintenanceCreate } from "@/components/forms/maintenance/sheet-create";
import { FormSheetStatusReportUpdateCreate } from "@/components/forms/status-report-update/sheet-create";
import { FormSheetStatusReportCreate } from "@/components/forms/status-report/sheet-create";
import { FormDialogSupportContact } from "@/components/forms/support-contact/dialog";
import { scrollToHash, useScrollToHash } from "@/hooks/use-scroll-to-hash";
import { useTRPC } from "@/lib/trpc/client";
import { switchWorkspace } from "@/lib/workspace-cookie";

import {
  type CommandLink,
  type CommandPage,
  type CommandSheet,
  type CommandSheetAction,
  CREATE_ACTIONS,
  CREATE_LINKS,
  HELP_LINK_ITEMS,
  HELP_SUPPORT_ACTION,
  NAVIGATION,
  pageLabel,
  SETTINGS,
} from "./config";
import { useCommandMenu } from "./provider";
import { MonitorScope } from "./scopes/monitor";
import { StatusPageScope } from "./scopes/status-page";

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
  const [activeSheet, setActiveSheet] = React.useState<CommandSheet | null>(
    null,
  );
  const [mounted, setMounted] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const trpc = useTRPC();

  useScrollToHash();

  // `enabled: open` keeps the always-mounted palette from fetching on every
  // dashboard load; data stays cached once fetched.
  const { data: monitors } = useQuery(
    trpc.monitor.list.queryOptions(undefined, { enabled: open }),
  );
  const { data: statusPages } = useQuery(
    trpc.page.list.queryOptions(undefined, { enabled: open }),
  );
  const { data: workspaces } = useQuery(
    trpc.workspace.list.queryOptions(undefined, { enabled: open }),
  );
  const { data: workspace } = useQuery(
    trpc.workspace.get.queryOptions(undefined, { enabled: open }),
  );
  // Inputs match the overview/create-sheet queries so create mutations
  // invalidate this cache entry too.
  const { data: statusReports } = useQuery(
    trpc.statusReport.list.queryOptions({}, { enabled: open }),
  );
  const { data: maintenances } = useQuery(
    trpc.maintenance.list.queryOptions(undefined, { enabled: open }),
  );

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

  const openSheet = (next: CommandSheet) => {
    setOpen(false);
    // Defer so the palette Dialog releases focus + scroll lock before the
    // sheet/dialog claims them — otherwise Radix layers fight during overlap.
    setTimeout(() => setActiveSheet(next), 0);
  };

  const idleCap = <T,>(items: T[]) =>
    search ? items : items.slice(0, IDLE_CAP);

  const otherWorkspaces =
    workspaces?.filter((w) => w.slug !== workspace?.slug) ?? [];

  // Unresolved reports first; within each partition keep server order (desc).
  const sortedStatusReports = statusReports
    ? [
        ...statusReports.filter((r) => r.status !== "resolved"),
        ...statusReports.filter((r) => r.status === "resolved"),
      ]
    : undefined;

  // Upcoming/active maintenances first, then past (server order desc).
  // Orphans without a page are skipped — no route to navigate to.
  const now = Date.now();
  const withPage = maintenances?.filter((m) => m.pageId !== null);
  const sortedMaintenances = withPage
    ? [
        ...withPage.filter((m) => m.to.getTime() >= now),
        ...withPage.filter((m) => m.to.getTime() < now),
      ]
    : undefined;

  const pageTitleById = new Map(statusPages?.map((p) => [p.id, p.title]) ?? []);

  const reportForUpdate =
    activeSheet?.sheet === "status-report-update"
      ? statusReports?.find((r) => r.id === activeSheet.reportId)
      : undefined;

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
                  {pageLabel(page)}
                  <button
                    type="button"
                    aria-label="Clear scope"
                    className="opacity-60 hover:opacity-100"
                    onClick={pop}
                  >
                    <Close className="size-3" />
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
            {/* inline style: twMerge drops the ui default max-h when a class
                overrides it, and a missed JIT class would leave the list
                unbounded — the style prop can't silently fail */}
            <CommandList style={{ maxHeight: "min(400px, 65vh)" }}>
              <CommandEmpty>No results found.</CommandEmpty>

              {page?.type === "monitor" ? (
                <MonitorScope page={page} navigate={navigate} />
              ) : page?.type === "status-page" ? (
                <StatusPageScope
                  page={page}
                  statusReports={statusReports}
                  maintenances={maintenances}
                  navigate={navigate}
                  onCreateStatusReport={() =>
                    openSheet({ sheet: "status-report", pageId: page.id })
                  }
                  onCreateMaintenance={() =>
                    openSheet({ sheet: "maintenance", pageId: page.id })
                  }
                  onAddReportUpdate={(reportId) =>
                    openSheet({ sheet: "status-report-update", reportId })
                  }
                />
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
                            <span className="text-muted-foreground font-commit-mono truncate text-xs">
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
                            <span className="text-muted-foreground font-commit-mono truncate text-xs">
                              {p.slug}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}

                  {sortedStatusReports && sortedStatusReports.length > 0 ? (
                    <CommandGroup heading="Status Reports">
                      {idleCap(sortedStatusReports).map((r) => (
                        <CommandItem
                          key={r.id}
                          value={`status-report-${r.id}`}
                          keywords={[r.title, r.status, r.page.title]}
                          onSelect={() =>
                            navigate(
                              `/status-pages/${r.pageId}/status-reports/${r.id}`,
                            )
                          }
                        >
                          <div className="grid min-w-0">
                            <span className="truncate">{r.title}</span>
                            <span className="text-muted-foreground font-commit-mono truncate text-xs">
                              {r.status} · {r.page.title}
                            </span>
                          </div>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}

                  {sortedMaintenances && sortedMaintenances.length > 0 ? (
                    <CommandGroup heading="Maintenances">
                      {idleCap(sortedMaintenances).map((m) => (
                        <CommandItem
                          key={m.id}
                          value={`maintenance-${m.id}`}
                          keywords={[
                            m.title,
                            pageTitleById.get(m.pageId ?? -1) ?? "",
                          ].filter(Boolean)}
                          onSelect={() =>
                            navigate(`/status-pages/${m.pageId}/maintenances`)
                          }
                        >
                          <div className="grid min-w-0">
                            <span className="truncate">{m.title}</span>
                            <span className="text-muted-foreground font-commit-mono truncate text-xs">
                              {m.from.toLocaleString()}
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
                        onSelect={() => openSheet({ sheet: action.sheet })}
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
                          <span className="text-muted-foreground font-commit-mono truncate text-xs">
                            {w.slug}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  ) : null}

                  <CommandGroup heading="Get Help">
                    <ActionItem
                      action={HELP_SUPPORT_ACTION}
                      onSelect={() => openSheet({ sheet: "support" })}
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
                        {resolvedTheme === "dark" ? <Light /> : <Dark />}
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
        open={activeSheet?.sheet === "status-report"}
        onOpenChange={(o) =>
          setActiveSheet(o ? { sheet: "status-report" } : null)
        }
        defaultPageId={
          activeSheet?.sheet === "status-report"
            ? activeSheet.pageId
            : undefined
        }
      />
      <FormSheetMaintenanceCreate
        open={activeSheet?.sheet === "maintenance"}
        onOpenChange={(o) =>
          setActiveSheet(o ? { sheet: "maintenance" } : null)
        }
        defaultPageId={
          activeSheet?.sheet === "maintenance" ? activeSheet.pageId : undefined
        }
      />
      <FormDialogSupportContact
        open={activeSheet?.sheet === "support"}
        onOpenChange={(o) => setActiveSheet(o ? { sheet: "support" } : null)}
      />
      {reportForUpdate ? (
        <FormSheetStatusReportUpdateCreate
          report={reportForUpdate}
          open={activeSheet?.sheet === "status-report-update"}
          onOpenChange={(o) => {
            if (!o) setActiveSheet(null);
          }}
        />
      ) : null}
    </>
  );
}
