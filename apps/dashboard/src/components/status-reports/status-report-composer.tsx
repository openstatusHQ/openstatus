"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { StatusReportStatus } from "@openstatus/db/src/schema";
import {
  type PageComponentImpact,
  pageComponentImpact,
} from "@openstatus/db/src/schema/page_components/constants";
import { statusReportStatus } from "@openstatus/db/src/schema/status_reports/constants";
import { Close } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import { Label } from "@openstatus/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { DateTimePicker } from "@/components/common/date-time-picker";
import { StatusDot } from "@/components/common/status-dot";
import {
  ComponentImpact,
  ComponentList,
  ComponentListActions,
  ComponentListAdd,
  ComponentListItem,
  ComponentListName,
  ComponentListSelectTrigger,
} from "@/components/content/component-list";
import {
  Composer,
  ComposerFooter,
  ComposerHeader,
  ComposerPreview,
  ComposerSection,
  ComposerTextarea,
} from "@/components/content/composer";
import { TimelineAvatar, TimelineItem } from "@/components/content/timeline";
import { personName } from "@/data/managed-incidents.client";
import { toGroupNameLookup } from "@/data/page-components.client";
import {
  getNextStatus,
  statusVariants,
  toCreateStatusReportUpdateInput,
} from "@/data/status-report-updates.client";
import { useTRPC } from "@/lib/trpc/client";
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
 * (carry the current impact; all operational once resolved); switching
 * status resets the overrides.
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
  const trpc = useTRPC();
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const [message, setMessage] = useState("");
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
      <TimelineAvatar
        name={user ? personName(user) : null}
        src={user?.photoUrl}
      />
      <Composer>
        <ComposerHeader />
        <ComposerTextarea
          placeholder="What changed? Customers will read this on the status page."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onSubmit={() => submit().catch(console.error)}
        />
        <ComposerPreview value={message} />
        {pageComponents.length ? (
          <ComposerSection>
            <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
              <span className="text-muted-foreground text-xs font-light tracking-wide uppercase">
                Affected components
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground -my-1 ml-auto h-7 font-normal"
                disabled={components.length === 0}
                onClick={() =>
                  setOverrides(
                    new Map(components.map((c) => [c.id, "operational"])),
                  )
                }
              >
                Mark all operational
              </Button>
            </div>
            <ComponentList>
              {components.map((component) => {
                const override = overrides.get(component.id);
                return (
                  <ComponentListItem
                    key={component.id}
                    // phones: name + current impact on one row, the picker below
                    className="flex-wrap sm:flex-nowrap"
                  >
                    <ComponentListName
                      group={groupOf.get(component.id)}
                      className="min-w-0 flex-1 sm:flex-none"
                    >
                      {component.name}
                    </ComponentListName>
                    <ComponentImpact
                      impact={currentImpacts.get(component.id)}
                    />
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
                          // phones: -ml-3 puts the text on the name's edge; from sm a
                          // fixed width keeps chevrons and close buttons in a column
                          className="text-foreground -ml-3 w-auto min-w-0 flex-1 font-mono sm:ml-0 sm:w-52 sm:flex-none"
                        >
                          <SelectValue
                            placeholder={
                              status === "resolved" ? (
                                <ComponentImpact
                                  impact="operational"
                                  className="text-muted-foreground"
                                />
                              ) : (
                                <span className="text-muted-foreground inline-flex items-center gap-1.5">
                                  <StatusDot />
                                  No change
                                </span>
                              )
                            }
                          />
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
            <ComponentListAdd
              components={addable}
              groups={groups}
              className="-ml-3 sm:ml-0"
              onAdd={(id) => {
                setIds([...componentIds, id]);
                // a component joins the report with a concrete impact
                if (!report.pageComponents.some((c) => c.id === id)) {
                  setOverrides((prev) =>
                    new Map(prev).set(id, "degraded_performance"),
                  );
                }
              }}
            />
          </ComposerSection>
        ) : null}
        <ComposerFooter>
          {/* phones: label column + field column so both fields share a left edge */}
          <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:flex-wrap">
            <span>Status</span>
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
            <span>at</span>
            <DateTimePicker
              key={now.getTime()}
              aria-label="Date"
              value={date ?? now}
              max={new Date()}
              onChange={setDate}
              className="bg-background text-foreground h-8 w-fit font-mono"
            />
          </div>
          <div className="ml-auto flex w-full flex-wrap items-center justify-between gap-3 sm:w-auto sm:justify-start">
            <div className="flex items-center gap-2">
              <Checkbox
                id="notify-subscribers"
                checked={notify}
                disabled={!canNotify}
                onCheckedChange={(value) => setNotifyChecked(value === true)}
              />
              <Label
                htmlFor="notify-subscribers"
                className="text-xs font-normal whitespace-nowrap"
                title={
                  canNotify
                    ? undefined
                    : "Subscriber notifications are not included in your plan."
                }
              >
                Notify subscribers
              </Label>
            </div>
            <Button
              size="sm"
              className="ml-auto"
              disabled={disabled}
              onClick={() => submit().catch(console.error)}
            >
              Publish update
            </Button>
          </div>
        </ComposerFooter>
      </Composer>
    </TimelineItem>
  );
}
