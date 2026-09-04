"use client";

import { Close, Search } from "@openstatus/icons";
import {
  Command,
  CommandEmpty,
  CommandList,
  CommandLoading,
} from "@openstatus/ui/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@openstatus/ui/components/ui/dialog";
import { Command as CommandPrimitive } from "cmdk";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import * as React from "react";

import { FormSheetMaintenanceCreate } from "@/components/forms/maintenance/sheet-create";
import { FormSheetStatusReportUpdateCreate } from "@/components/forms/status-report-update/sheet-create";
import { FormSheetStatusReportCreate } from "@/components/forms/status-report/sheet-create";
import { FormDialogSupportContact } from "@/components/forms/support-contact/dialog";
import { scrollToHash, useScrollToHash } from "@/hooks/use-scroll-to-hash";
import { switchWorkspace } from "@/lib/workspace-cookie";

import { GroupView } from "./group-view";
import {
  maintenancesGroup,
  monitorsGroup,
  statusPagesGroup,
  statusReportsGroup,
  workspacesGroup,
} from "./groups/entities";
import { monitorScopeGroups } from "./groups/monitor-scope";
import {
  createGroup,
  helpGroup,
  navigationGroup,
  settingsGroup,
  themeGroup,
} from "./groups/static";
import { statusPageScopeGroups } from "./groups/status-page-scope";
import { useCommandMenu } from "./provider";
import type {
  CommandAction,
  CommandMenuGroup,
  CommandPage,
  CommandSheet,
} from "./types";
import { pageLabel } from "./types";
import { useCommandMenuData } from "./use-command-menu-data";

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

  useScrollToHash();

  const data = useCommandMenuData({ open });

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

  const openSheet = (next: CommandSheet) => {
    setOpen(false);
    // Defer so the palette Dialog releases focus + scroll lock before the
    // sheet/dialog claims them — otherwise Radix layers fight during overlap.
    setTimeout(() => setActiveSheet(next), 0);
  };

  const dispatch = (action: CommandAction) => {
    switch (action.type) {
      case "navigate":
        navigate(action.href);
        break;
      case "external":
        window.open(action.href, "_blank", "noreferrer");
        setOpen(false);
        break;
      case "sheet":
        openSheet(action.sheet);
        break;
      case "push":
        pushPage(action.page);
        break;
      case "run":
        // Intentionally leaves the palette open (theme toggle, workspace switch).
        action.run();
        break;
    }
  };

  const groups: CommandMenuGroup[] = page
    ? page.type === "monitor"
      ? monitorScopeGroups(page)
      : statusPageScopeGroups({
          page,
          statusReports: data.sortedStatusReports,
          maintenances: data.sortedMaintenances,
        })
    : [
        monitorsGroup(data.monitors),
        statusPagesGroup(data.statusPages),
        statusReportsGroup(data.sortedStatusReports),
        maintenancesGroup(data.sortedMaintenances, data.pageTitleById),
        navigationGroup(),
        createGroup(),
        settingsGroup(),
        workspacesGroup(data.otherWorkspaces, switchWorkspace),
        helpGroup(),
        ...(mounted ? [themeGroup(resolvedTheme, setTheme)] : []),
      ].filter((g): g is CommandMenuGroup => g !== null);

  const reportForUpdate =
    activeSheet?.sheet === "status-report-update"
      ? data.statusReports?.find((r) => r.id === activeSheet.reportId)
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
              {!page && data.monitors === undefined ? (
                <CommandLoading>Loading…</CommandLoading>
              ) : null}
              {groups.map((group) => (
                <GroupView
                  key={group.heading}
                  group={group}
                  search={search}
                  onAction={dispatch}
                />
              ))}
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
