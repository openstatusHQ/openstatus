"use client";

import type { RouterOutputs } from "@openstatus/api";
import type { StatusReportStatus } from "@openstatus/db/src/schema";
import {
  type PageComponentImpact,
  currentImpactsFromUpdates,
  pageComponentImpact,
} from "@openstatus/db/src/schema/page_components/constants";
import { statusReportStatus } from "@openstatus/db/src/schema/status_reports/constants";
import { Close, Next } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import { Input } from "@openstatus/ui/components/ui/input";
import { Label } from "@openstatus/ui/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { useState } from "react";
import { toast } from "sonner";

import { StatusDot } from "@/components/common/status-dot";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  Composer,
  ComposerFooter,
  ComposerHeader,
  ComposerHint,
  ComposerPreview,
  ComposerSection,
  ComposerTabs,
  ComposerTextarea,
} from "@/components/content/composer";
import { TimelineItem } from "@/components/content/timeline";
import { toLocalInput } from "@/components/forms/incident/form";
import { personName } from "@/data/managed-incidents.client";
import {
  defaultComponentImpacts,
  getNextStatus,
  impactConfig,
  impactVariants,
  statusVariants,
  toCreateStatusReportUpdateInput,
} from "@/data/status-report-updates.client";
import { useTRPC } from "@/lib/trpc/client";

import { useInvalidateStatusReport } from "./use-invalidate-status-report";

type StatusReport = NonNullable<RouterOutputs["statusReport"]["get"]>;

/**
 * Publishes a status report update. Impact rows default to "No change"
 * (carry the current impact; all operational once resolved); switching
 * status resets the overrides.
 */
export function StatusReportComposer({
  report,
  pageComponents,
  canNotify,
}: {
  report: StatusReport;
  /** Every component on the page; the ones not on the report can be added. */
  pageComponents: { id: number; name: string }[];
  /** Whether the plan includes subscriber notifications. */
  canNotify: boolean;
}) {
  const trpc = useTRPC();
  const { data: user } = useQuery(trpc.user.get.queryOptions());
  const [message, setMessage] = useState("");
  const [notifyChecked, setNotifyChecked] = useState(true);
  const notify = canNotify && notifyChecked;
  const [selected, setSelected] = useState<StatusReportStatus | null>(null);
  const [date, setDate] = useState(() => toLocalInput(new Date()));
  const [overrides, setOverrides] = useState<Map<number, PageComponentImpact>>(
    () => new Map(),
  );
  const [removed, setRemoved] = useState<Set<number>>(() => new Set());
  const [added, setAdded] = useState<number[]>([]);

  const invalidate = useInvalidateStatusReport(report.id);
  const create = useMutation(
    trpc.statusReport.createStatusReportUpdate.mutationOptions(),
  );
  const send = useMutation(
    trpc.subscriberNotification.statusReport.mutationOptions(),
  );
  const pending = create.isPending || send.isPending;
  const status = selected ?? getNextStatus(report.status);
  const disabled = pending || !message.trim() || !date;

  const currentImpacts = currentImpactsFromUpdates(report.updates);
  const reportHasImpacts = report.updates.some(
    (u) => u.componentImpacts.length > 0,
  );
  const components = [
    ...report.pageComponents,
    ...added.flatMap((id) => pageComponents.filter((c) => c.id === id)),
  ].filter((c) => !removed.has(c.id));
  const addable = pageComponents.filter(
    (c) => !components.some((rc) => rc.id === c.id),
  );
  const defaults = new Map(
    defaultComponentImpacts({
      components,
      currentImpacts,
      nextStatus: status,
    }).map((ci) => [ci.pageComponentId, ci.impact]),
  );

  function reset() {
    setMessage("");
    setSelected(null);
    setDate(toLocalInput(new Date()));
    setOverrides(new Map());
    setRemoved(new Set());
    setAdded([]);
  }

  async function submit() {
    if (disabled) return;
    const promise = (async () => {
      const update = await create.mutateAsync(
        toCreateStatusReportUpdateInput({
          statusReportId: report.id,
          values: {
            status,
            message: message.trim(),
            date: new Date(date),
            componentImpacts: components.map((c) => ({
              pageComponentId: c.id,
              impact:
                overrides.get(c.id) ?? defaults.get(c.id) ?? "operational",
            })),
            notifySubscribers: notify,
          },
          reportHasImpacts,
        }),
      );
      if (update && notify) await send.mutateAsync({ id: update.id });
      await invalidate();
    })();
    toast.promise(promise, {
      loading: "Publishing...",
      success: "Update published",
      error: (error) =>
        isTRPCClientError(error) ? error.message : "Failed to publish",
    });
    await promise;
    reset();
  }

  return (
    <TimelineItem>
      <UserAvatar
        name={user ? personName(user) : null}
        src={user?.photoUrl}
        className="size-8 text-xs"
      />
      <Composer>
        <ComposerHeader>
          <ComposerTabs />
          <ComposerHint>Markdown</ComposerHint>
        </ComposerHeader>
        <ComposerTextarea
          placeholder="What changed? Customers will read this on the status page."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <ComposerPreview value={message} />
        {pageComponents.length ? (
          <ComposerSection>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground text-xs font-light tracking-wide uppercase">
                Affected components
              </span>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground -my-1 h-7 font-normal"
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
            <ul className="flex flex-col gap-1">
              {components.map((component) => {
                const current = currentImpacts.get(component.id);
                const override = overrides.get(component.id);
                return (
                  <li
                    key={component.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <StatusDot
                      variant={current ? impactVariants[current] : "default"}
                    />
                    <span className="truncate font-mono">{component.name}</span>
                    <span className="text-muted-foreground shrink-0 font-mono text-xs uppercase">
                      {current ? impactConfig[current].label : "Untriaged"}
                    </span>
                    <Next className="text-muted-foreground/50 ml-auto size-3 shrink-0" />
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
                      <SelectTrigger
                        size="sm"
                        aria-label={`${component.name} impact`}
                        className="hover:bg-accent dark:hover:bg-accent/50 data-[state=open]:bg-accent text-foreground border-transparent bg-transparent font-mono shadow-none dark:bg-transparent"
                      >
                        <SelectValue
                          placeholder={
                            <span className="text-muted-foreground inline-flex items-center gap-2">
                              <StatusDot
                                variant={
                                  status === "resolved" ? "success" : "default"
                                }
                              />
                              {status === "resolved"
                                ? "Operational"
                                : "No change"}
                            </span>
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {pageComponentImpact.map((impact) => (
                          <SelectItem
                            key={impact}
                            value={impact}
                            className="font-mono"
                          >
                            <StatusDot variant={impactVariants[impact]} />
                            {impactConfig[impact].label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground size-7"
                      aria-label={`Leave ${component.name} out of this update`}
                      onClick={() => {
                        setAdded((prev) =>
                          prev.filter((id) => id !== component.id),
                        );
                        setRemoved((prev) => new Set(prev).add(component.id));
                      }}
                    >
                      <Close />
                    </Button>
                  </li>
                );
              })}
            </ul>
            <Select
              value=""
              disabled={addable.length === 0}
              onValueChange={(value) => {
                const id = Number(value);
                setRemoved((prev) => {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                });
                if (report.pageComponents.some((c) => c.id === id)) return;
                setAdded((prev) => [...prev, id]);
                // a component joins the report with a concrete impact
                setOverrides((prev) =>
                  new Map(prev).set(id, "degraded_performance"),
                );
              }}
            >
              <SelectTrigger
                size="sm"
                aria-label="Add component"
                className="hover:bg-accent dark:hover:bg-accent/50 data-[state=open]:bg-accent text-muted-foreground w-fit border-transparent bg-transparent shadow-none dark:bg-transparent"
              >
                <SelectValue
                  placeholder={
                    addable.length ? "Add component" : "All components added"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {addable.map((c) => (
                  <SelectItem
                    key={c.id}
                    value={String(c.id)}
                    className="font-mono"
                  >
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </ComposerSection>
        ) : null}
        <ComposerFooter>
          <div className="flex flex-wrap items-center gap-2">
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
            <Input
              type="datetime-local"
              aria-label="Date"
              value={date}
              max={toLocalInput(new Date())}
              onChange={(e) => setDate(e.target.value)}
              className="bg-background text-foreground h-8 w-auto font-mono md:text-sm"
            />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Checkbox
                id="notify-subscribers"
                checked={notify}
                disabled={!canNotify}
                onCheckedChange={(value) => setNotifyChecked(value === true)}
              />
              <Label
                htmlFor="notify-subscribers"
                className="text-xs font-normal"
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
