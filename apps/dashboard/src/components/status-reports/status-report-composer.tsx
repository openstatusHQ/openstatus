"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { StatusReportStatus } from "@openstatus/db/src/schema";
import {
  type PageComponentImpact,
  pageComponentImpact,
} from "@openstatus/db/src/schema/page_components/constants";
import { statusReportStatus } from "@openstatus/db/src/schema/status_reports/constants";
import { Close, Components } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@openstatus/ui/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useState } from "react";
import { toast } from "sonner";

import { DateTimePicker } from "@/components/common/date-time-picker";
import { StatusDot } from "@/components/common/status-dot";
import {
  ComponentImpact,
  ComponentList,
  ComponentListActions,
  ComponentListItem,
  ComponentListName,
  ComponentListSelectTrigger,
} from "@/components/content/component-list";
import {
  Composer,
  ComposerActions,
  ComposerFooter,
  ComposerNotifyToggle,
  ComposerPreview,
  ComposerPreviewToggle,
  ComposerSection,
  ComposerSubmit,
  ComposerTextarea,
  useComposerDraft,
} from "@/components/content/composer";
import { TimelineItem } from "@/components/content/timeline";
import {
  toComponentSections,
  toGroupNameLookup,
} from "@/data/page-components.client";
import {
  getNextStatus,
  statusVariants,
  toCreateStatusReportUpdateInput,
} from "@/data/status-report-updates.client";
import { errorMessage } from "@/lib/trpc/error";

import { usePublishUpdate } from "./use-publish-update";

type StatusReport = NonNullable<RouterOutputs["statusReport"]["get"]>;
type Component = {
  id: number;
  name: string;
  groupId?: number | null;
  order?: number | null;
  groupOrder?: number | null;
};

/**
 * Publishes a status report update. Impact rows default to "No change"
 * (carry the current impact; all operational once resolved); a picked value
 * reads in the foreground. Switching status resets the overrides.
 */
export function StatusReportComposer({
  report,
  currentImpacts,
  pageComponents,
  groups,
  canNotify,
}: {
  report: StatusReport;
  currentImpacts: Map<number, PageComponentImpact>;
  /** Every component on the page; the ones not on the report can be added. */
  pageComponents: Component[];
  groups: { id: number; name: string }[];
  /** Whether the plan includes subscriber notifications. */
  canNotify: boolean;
}) {
  const [message, setMessage] = useComposerDraft(`status-report:${report.id}`);
  const [notifyChecked, setNotifyChecked] = useState(true);
  const [selected, setSelected] = useState<StatusReportStatus | null>(null);
  // null = now, resolved at publish time so an open composer never backdates.
  const [date, setDate] = useState<Date | null>(null);
  // shown while `date` is null; refreshed on reset
  const [now, setNow] = useState(() => new Date());
  const [overrides, setOverrides] = useState<Map<number, PageComponentImpact>>(
    () => new Map(),
  );
  // null = the report's own components; an edit replaces the set for this update.
  const [ids, setIds] = useState<number[] | null>(null);

  const publish = usePublishUpdate(report.id);
  const notify = canNotify && notifyChecked;
  const status = selected ?? getNextStatus(report.status);
  const invalidDate = date !== null && date > new Date();
  const disabled = publish.isPending || !message.trim() || invalidDate;

  const byId = new Map<number, Component>(
    [...report.pageComponents, ...pageComponents].map((c) => [c.id, c]),
  );
  const componentIds = ids ?? report.pageComponents.map((c) => c.id);
  const components = componentIds.flatMap((id) => byId.get(id) ?? []);
  const addable = pageComponents.filter((c) => !componentIds.includes(c.id));
  const groupOf = toGroupNameLookup(pageComponents, groups);
  const reportHasImpacts = report.updates.some(
    (u) => u.componentImpacts.length > 0,
  );
  const impactFor = (id: number): PageComponentImpact =>
    overrides.get(id) ??
    (status === "resolved"
      ? "operational"
      : (currentImpacts.get(id) ?? "operational"));

  function reset() {
    setMessage("");
    setSelected(null);
    setDate(null);
    setNow(new Date());
    setOverrides(new Map());
    setIds(null);
  }

  async function submit() {
    if (disabled) return;
    const promise = publish.publish(
      toCreateStatusReportUpdateInput({
        statusReportId: report.id,
        values: {
          status,
          message: message.trim(),
          date: date ?? new Date(),
          componentImpacts: components.map((c) => ({
            pageComponentId: c.id,
            impact: impactFor(c.id),
          })),
          notifySubscribers: notify,
        },
        reportHasImpacts,
      }),
    );
    toast.promise(promise, {
      loading: "Publishing...",
      success: "Update published",
      error: (error) => errorMessage(error, "Failed to publish"),
    });
    await promise;
    reset();
  }

  return (
    <TimelineItem>
      <Composer className="col-span-full">
        <ComposerTextarea
          placeholder="What changed? Customers will read this on the status page."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onSubmit={() => submit().catch(console.error)}
        />
        <ComposerPreview value={message} />
        {components.length ? (
          <ComposerSection>
            <ComponentList>
              {components.map((component) => {
                const current = currentImpacts.get(component.id);
                const override = overrides.get(component.id);
                const effective = impactFor(component.id);
                // a legacy row (no current impact) only changes once a value is picked
                const changed = current
                  ? effective !== current
                  : override !== undefined;
                const value = changed ? (
                  <ComponentImpact
                    impact={effective}
                    className="text-foreground"
                  />
                ) : current ? (
                  <ComponentImpact
                    impact={current}
                    className="text-muted-foreground"
                  />
                ) : (
                  <span className="text-muted-foreground inline-flex items-center gap-1.5">
                    <StatusDot />
                    No change
                  </span>
                );
                return (
                  <ComponentListItem
                    key={component.id}
                    // phones: name on one row, the picker below
                    className="flex-wrap sm:flex-nowrap"
                  >
                    <ComponentListName
                      group={groupOf.get(component.id)}
                      className="min-w-0 flex-1 sm:flex-initial"
                    >
                      {component.name}
                    </ComponentListName>
                    <ComponentListActions className="basis-full sm:basis-auto">
                      <Select
                        value={override ?? ""}
                        onValueChange={(value) => {
                          const impact = pageComponentImpact.find(
                            (i) => i === value,
                          );
                          if (!impact) return;
                          setOverrides((prev) =>
                            new Map(prev).set(component.id, impact),
                          );
                        }}
                      >
                        <ComponentListSelectTrigger
                          aria-label={`${component.name} impact`}
                          // phones: -ml-3 puts the text on the name's edge
                          className="-ml-3 w-auto min-w-0 flex-1 font-mono sm:ml-0 sm:flex-none"
                        >
                          <SelectValue placeholder={value}>{value}</SelectValue>
                        </ComponentListSelectTrigger>
                        <SelectContent>
                          {pageComponentImpact.map((impact) => (
                            <SelectItem key={impact} value={impact}>
                              <ComponentImpact impact={impact} />
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground size-7"
                        aria-label={`Leave ${component.name} out of this update`}
                        onClick={() =>
                          setIds(
                            componentIds.filter((id) => id !== component.id),
                          )
                        }
                      >
                        <Close />
                      </Button>
                    </ComponentListActions>
                  </ComponentListItem>
                );
              })}
            </ComponentList>
          </ComposerSection>
        ) : null}
        <ComposerFooter>
          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={status}
              onValueChange={(value) => {
                const next = statusReportStatus.find((s) => s === value);
                if (!next) return;
                setSelected(next);
                setOverrides(new Map());
              }}
            >
              <SelectTrigger
                size="sm"
                aria-label="Status"
                className="bg-background text-foreground font-mono"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusReportStatus.map((s) => (
                  <SelectItem key={s} value={s} className="font-mono">
                    <StatusDot variant={statusVariants[s]} />
                    <span className="capitalize">{s}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* "at" wraps together with its date on phones */}
            <span className="flex items-center gap-2">
              at
              <DateTimePicker
                key={now.getTime()}
                aria-label="Date"
                value={date ?? now}
                max={new Date()}
                onChange={setDate}
                className="bg-background text-foreground h-8 w-fit font-mono"
              />
            </span>
          </div>
          <ComposerActions>
            <ComposerPreviewToggle />
            <ComponentsMenu
              addable={addable}
              groups={groups}
              onAdd={(id) => {
                setIds([...componentIds, id]);
                // a component joins the report with a concrete impact
                if (!report.pageComponents.some((c) => c.id === id)) {
                  setOverrides((prev) =>
                    new Map(prev).set(id, "degraded_performance"),
                  );
                }
              }}
              // bulk restore only once there is something to restore
              onMarkAllOperational={
                components.length > 1 &&
                components.some((c) => impactFor(c.id) !== "operational")
                  ? () =>
                      setOverrides(
                        new Map(components.map((c) => [c.id, "operational"])),
                      )
                  : undefined
              }
            />
            <ComposerNotifyToggle
              canNotify={canNotify}
              pressed={notifyChecked}
              onPressedChange={setNotifyChecked}
            />
            <ComposerSubmit
              label="Publish update"
              disabled={disabled}
              onClick={() => submit().catch(console.error)}
            />
          </ComposerActions>
        </ComposerFooter>
      </Composer>
    </TimelineItem>
  );
}

/**
 * Footer icon button for the affected components: a searchable picker of
 * the page's components not yet on the update, plus the bulk restore when
 * the composer offers one. Disabled with nothing to offer; always titled.
 */
function ComponentsMenu({
  addable,
  groups,
  onAdd,
  onMarkAllOperational,
}: {
  addable: Component[];
  groups: { id: number; name: string }[];
  onAdd: (id: number) => void;
  onMarkAllOperational?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const sections = toComponentSections(addable, groups);
  const disabled = addable.length === 0 && !onMarkAllOperational;
  const label = addable.length
    ? "Add component"
    : onMarkAllOperational
      ? "Affected components"
      : "All components added";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            {/* aria-disabled (not disabled) so the tooltip still explains why */}
            <Button
              variant="outline"
              size="icon-sm"
              role="combobox"
              aria-expanded={open}
              aria-label={label}
              aria-disabled={disabled}
              className="text-muted-foreground data-[state=open]:text-foreground aria-disabled:opacity-50"
              onClick={(e) => {
                if (disabled) e.preventDefault();
              }}
            >
              <Components />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent side="top">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-64 p-0">
        <Command>
          {addable.length ? (
            <CommandInput placeholder="Search components..." className="h-9" />
          ) : null}
          <CommandList>
            <CommandEmpty>No components found.</CommandEmpty>
            {onMarkAllOperational ? (
              <CommandGroup>
                <CommandItem
                  value="mark-all-operational"
                  onSelect={() => {
                    onMarkAllOperational();
                    setOpen(false);
                  }}
                >
                  <StatusDot variant="success" />
                  Mark all operational
                </CommandItem>
              </CommandGroup>
            ) : null}
            {onMarkAllOperational && sections.length ? (
              <CommandSeparator />
            ) : null}
            {sections.map((section, i) => (
              <CommandGroup
                key={section.group?.id ?? `ungrouped-${i}`}
                heading={section.group?.name}
              >
                {section.items.map((c) => (
                  <CommandItem
                    key={c.id}
                    // unique per item; cmdk filters on this string
                    value={`${c.name} ${c.id}`}
                    className="font-mono"
                    onSelect={() => {
                      onAdd(c.id);
                      setOpen(false);
                    }}
                  >
                    {c.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
