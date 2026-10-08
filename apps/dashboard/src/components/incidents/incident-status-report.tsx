"use client";

import type { RouterOutputs } from "@openstatus/api";
import { statusReportStatus } from "@openstatus/db/src/schema/status_reports/constants";
import { Check, Expand } from "@openstatus/icons";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openstatus/ui/components/ui/alert-dialog";
import { Button } from "@openstatus/ui/components/ui/button";
import { Checkbox } from "@openstatus/ui/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@openstatus/ui/components/ui/command";
import { Label } from "@openstatus/ui/components/ui/label";
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
import { Textarea } from "@openstatus/ui/components/ui/textarea";
import { cn } from "@openstatus/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Link } from "@/components/common/link";
import { StatusDot } from "@/components/common/status-dot";
import {
  ActionCard,
  ActionCardContent,
  ActionCardDescription,
  ActionCardFooter,
  ActionCardHeader,
  ActionCardTitle,
} from "@/components/content/action-card";
import { FormSheetStatusReportCreate } from "@/components/forms/status-report/sheet-create";
import { usePublishUpdate } from "@/components/status-reports/use-publish-update";
import { statusVariants } from "@/data/status-report-updates.client";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

type Incident = NonNullable<RouterOutputs["incident"]["get"]>;

export function IncidentStatusReport({
  incident,
  canNotify,
}: {
  incident: Incident;
  canNotify: boolean;
}) {
  if (incident.statusReport) {
    return (
      <LinkedReport
        incident={incident}
        report={incident.statusReport}
        canNotify={canNotify}
      />
    );
  }
  return <UnlinkedReport incident={incident} />;
}

function NotifySubscribers({
  id,
  checked,
  onCheckedChange,
}: {
  id: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
      />
      <Label htmlFor={id}>Notify subscribers</Label>
    </div>
  );
}

function LinkedReport({
  incident,
  report,
  canNotify,
}: {
  incident: Incident;
  report: NonNullable<Incident["statusReport"]>;
  canNotify: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const [status, setStatus] = useState<string>(
    report.status === "resolved" ? "monitoring" : report.status,
  );
  const [message, setMessage] = useState("");
  const [notifySubscribers, setNotifySubscribers] = useState(canNotify);
  const update = usePublishUpdate(report.id);
  const unlink = useMutation(
    trpc.incident.unlinkStatusReport.mutationOptions({
      onSuccess: () => {
        setConfirmUnlink(false);
        return Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.incident.get.queryKey({ id: incident.id }),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.incident.linkedStatusReportIds.queryKey(),
          }),
        ]);
      },
      onError: (error) => toast.error(errorMessage(error)),
    }),
  );
  const closed = incident.closedAt !== null;

  async function post() {
    const parsed = statusReportStatus.find((s) => s === status);
    if (!parsed) return;
    const promise = update.publish({
      statusReportId: report.id,
      status: parsed,
      message,
      date: new Date(),
      notifySubscribers,
    });
    toast.promise(promise, {
      loading: "Posting public update...",
      success: "Public update posted",
      error: (error) => errorMessage(error),
    });
    await promise;
    setMessage("");
    setComposing(false);
  }

  return (
    <ActionCard>
      <ActionCardHeader>
        <ActionCardTitle className="flex items-center gap-2 text-sm">
          Published
          <span className="text-muted-foreground ml-auto flex items-center gap-2 font-mono text-xs font-normal capitalize">
            <StatusDot variant={statusVariants[report.status]} />
            {report.status}
          </span>
        </ActionCardTitle>
        <ActionCardDescription>
          {report.pageId ? (
            <Link
              href={`/status-pages/${report.pageId}/status-reports/${report.id}`}
            >
              {report.title}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{report.title}</span>
          )}{" "}
          is what customers see on your status page.
        </ActionCardDescription>
      </ActionCardHeader>
      {composing ? (
        <ActionCardContent className="grid gap-2">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger size="sm" className="w-full font-mono capitalize">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {statusReportStatus.map((s) => (
                <SelectItem key={s} value={s} className="font-mono capitalize">
                  <StatusDot variant={statusVariants[s]} />
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Textarea
            rows={3}
            placeholder="Message shown on your status page"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {canNotify ? (
            <NotifySubscribers
              id="incident-report-notify"
              checked={notifySubscribers}
              onCheckedChange={setNotifySubscribers}
            />
          ) : null}
        </ActionCardContent>
      ) : null}
      <ActionCardFooter className="flex-wrap gap-2">
        {composing ? (
          <>
            <Button
              size="sm"
              disabled={!message.trim() || update.isPending}
              onClick={() => post().catch(console.error)}
            >
              Post public update
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setComposing(false)}
            >
              Cancel
            </Button>
          </>
        ) : (
          <>
            <Button size="sm" onClick={() => setComposing(true)}>
              Post public update
            </Button>
            {closed ? null : (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setConfirmUnlink(true)}
              >
                Unlink
              </Button>
            )}
          </>
        )}
      </ActionCardFooter>
      <AlertDialog open={confirmUnlink} onOpenChange={setConfirmUnlink}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unlink this status report?</AlertDialogTitle>
            <AlertDialogDescription>
              {report.title} stays on your status page as it is, but updates
              from this incident no longer reach it. You can link it again
              later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep linked</AlertDialogCancel>
            <AlertDialogAction
              disabled={unlink.isPending}
              onClick={(e) => {
                e.preventDefault();
                unlink.mutate({ id: incident.id });
              }}
            >
              Unlink
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ActionCard>
  );
}

function UnlinkedReport({ incident }: { incident: Incident }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [linking, setLinking] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [reportId, setReportId] = useState<number | null>(null);
  const closed = incident.closedAt !== null;

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.incident.get.queryKey({ id: incident.id }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.incident.listEvents.queryKey({ id: incident.id }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.incident.linkedStatusReportIds.queryKey(),
      }),
    ]);
  const link = useMutation(
    trpc.incident.linkStatusReport.mutationOptions({ onSuccess: refresh }),
  );
  const { data: reports } = useQuery({
    ...trpc.statusReport.list.queryOptions({ order: "desc" }),
    enabled: !closed,
  });
  const { data: linkedIds } = useQuery({
    ...trpc.incident.linkedStatusReportIds.queryOptions(),
    enabled: !closed,
  });
  // Until both load, the list could offer reports another incident holds.
  const linked = linkedIds ? new Set(linkedIds) : null;
  const linkable =
    reports && linked ? reports.filter((r) => !linked.has(r.id)) : [];
  const selected = linkable.find((r) => r.id === reportId);
  // Closing mid-edit would otherwise strand a form whose footer is gone.
  const showLink = !closed && linking && linkable.length > 0;

  return (
    <ActionCard className="border-dashed">
      <ActionCardHeader>
        <ActionCardTitle className="flex items-center gap-2 text-sm">
          <span
            aria-hidden="true"
            className="border-muted-foreground size-2 shrink-0 rounded-full border"
          />
          Not published
        </ActionCardTitle>
        <ActionCardDescription>
          {closed
            ? "This incident was never linked to a status report."
            : "Nothing here is public. Customers only see what you publish on your status page."}
        </ActionCardDescription>
      </ActionCardHeader>
      {showLink ? (
        <ActionCardContent className="grid gap-2">
          <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                role="combobox"
                aria-expanded={pickerOpen}
                className={cn(
                  "w-full justify-between font-normal",
                  !selected && "text-muted-foreground",
                )}
              >
                {selected ? (
                  <span className="flex min-w-0 items-center gap-2">
                    <StatusDot variant={statusVariants[selected.status]} />
                    <span className="truncate">{selected.title}</span>
                  </span>
                ) : (
                  "Search status reports..."
                )}
                <Expand className="size-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandInput placeholder="Search status reports..." />
                <CommandList>
                  <CommandEmpty>No status report found.</CommandEmpty>
                  <CommandGroup>
                    {linkable.map((r) => (
                      <CommandItem
                        key={r.id}
                        value={String(r.id)}
                        keywords={[r.title, r.page.title, r.status]}
                        onSelect={() => {
                          setReportId(r.id);
                          setPickerOpen(false);
                        }}
                      >
                        <StatusDot variant={statusVariants[r.status]} />
                        <span className="truncate">{r.title}</span>
                        <span className="text-muted-foreground ml-auto truncate text-xs">
                          {r.page.title}
                        </span>
                        <Check
                          className={cn(
                            "size-4 shrink-0",
                            r.id === reportId ? "opacity-100" : "opacity-0",
                          )}
                        />
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </ActionCardContent>
      ) : null}
      {closed ? null : (
        <ActionCardFooter className="flex-wrap gap-2">
          {showLink ? (
            <>
              <Button
                size="sm"
                disabled={!selected || link.isPending}
                onClick={() =>
                  selected &&
                  toast.promise(
                    link.mutateAsync({
                      id: incident.id,
                      statusReportId: selected.id,
                    }),
                    {
                      loading: "Linking...",
                      success: "Status report linked",
                      error: (error) => errorMessage(error),
                    },
                  )
                }
              >
                Link
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setLinking(false)}
              >
                Cancel
              </Button>
            </>
          ) : (
            <>
              <Button size="sm" onClick={() => setCreateOpen(true)}>
                Create status report
              </Button>
              {linkable.length > 0 ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setLinking(true)}
                >
                  Link existing
                </Button>
              ) : null}
            </>
          )}
        </ActionCardFooter>
      )}
      {/* Mounted on demand: the sheet fetches pages as soon as it renders. */}
      {createOpen ? (
        <FormSheetStatusReportCreate
          open
          onOpenChange={setCreateOpen}
          incidentId={incident.id}
          onCreated={() => refresh().catch(console.error)}
        />
      ) : null}
    </ActionCard>
  );
}
