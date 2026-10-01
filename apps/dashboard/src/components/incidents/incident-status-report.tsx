"use client";

import type { RouterOutputs } from "@openstatus/api";
import { statusReportStatus } from "@openstatus/db/src/schema/status_reports/constants";
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
import { Textarea } from "@openstatus/ui/components/ui/textarea";
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
  return <UnlinkedReport incident={incident} canNotify={canNotify} />;
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
  const [status, setStatus] = useState<string>(
    report.status === "resolved" ? "monitoring" : report.status,
  );
  const [message, setMessage] = useState("");
  const [notifySubscribers, setNotifySubscribers] = useState(canNotify);
  const update = usePublishUpdate(report.id);
  const unlink = useMutation(
    trpc.incident.unlinkStatusReport.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.incident.get.queryKey({ id: incident.id }),
        }),
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
          <StatusDot variant={statusVariants[report.status]} />
          Published
          <span className="text-muted-foreground ml-auto font-mono text-xs font-normal capitalize">
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
                disabled={unlink.isPending}
                onClick={() => unlink.mutate({ id: incident.id })}
              >
                Unlink
              </Button>
            )}
          </>
        )}
      </ActionCardFooter>
    </ActionCard>
  );
}

function UnlinkedReport({
  incident,
  canNotify,
}: {
  incident: Incident;
  canNotify: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { data: pages } = useQuery(trpc.page.list.queryOptions());
  const [draftMode, setMode] = useState<"link" | "create" | null>(null);
  const [reportId, setReportId] = useState<string>("");
  const [pageId, setPageId] = useState<string>("");
  const [title, setTitle] = useState(incident.title);
  const [message, setMessage] = useState("");
  const [notifySubscribers, setNotifySubscribers] = useState(canNotify);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({
        queryKey: trpc.incident.get.queryKey({ id: incident.id }),
      }),
      queryClient.invalidateQueries({
        queryKey: trpc.incident.listEvents.queryKey({ id: incident.id }),
      }),
    ]);
  const link = useMutation(
    trpc.incident.linkStatusReport.mutationOptions({ onSuccess: refresh }),
  );
  const create = useMutation(
    trpc.statusReport.create.mutationOptions({ onSuccess: refresh }),
  );
  const notify = useMutation(
    trpc.subscriberNotification.statusReport.mutationOptions(),
  );
  const closed = incident.closedAt !== null;
  // Closing mid-edit would otherwise strand a form whose footer is gone.
  const mode = closed ? null : draftMode;
  const { data: reports } = useQuery({
    ...trpc.statusReport.list.queryOptions({ order: "desc" }),
    enabled: mode === "link",
  });

  async function createReport() {
    const promise = (async () => {
      const created = await create.mutateAsync({
        title,
        status: "investigating",
        pageId: Number(pageId),
        pageComponents: [],
        date: new Date(),
        message,
        notifySubscribers,
        incidentId: incident.id,
      });
      if (created && notifySubscribers) {
        await notify.mutateAsync({ id: created.id });
      }
    })();
    toast.promise(promise, {
      loading: "Creating status report...",
      success: "Status report created",
      error: (error) => errorMessage(error),
    });
    await promise;
    setMode(null);
  }

  const openReports = (reports ?? []).filter((r) => r.status !== "resolved");

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
      {mode === "link" ? (
        <ActionCardContent className="grid gap-2">
          <Select value={reportId} onValueChange={setReportId}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="Select an open report" />
            </SelectTrigger>
            <SelectContent>
              {openReports.map((r) => (
                <SelectItem key={r.id} value={String(r.id)}>
                  {r.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ActionCardContent>
      ) : null}
      {mode === "create" ? (
        <ActionCardContent className="grid gap-2">
          <Select value={pageId} onValueChange={setPageId}>
            <SelectTrigger size="sm" className="w-full">
              <SelectValue placeholder="Select a status page" />
            </SelectTrigger>
            <SelectContent>
              {(pages ?? []).map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            aria-label="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <Textarea
            rows={3}
            placeholder="First public message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {canNotify ? (
            <NotifySubscribers
              id="incident-create-notify"
              checked={notifySubscribers}
              onCheckedChange={setNotifySubscribers}
            />
          ) : null}
        </ActionCardContent>
      ) : null}
      {closed ? null : (
        <ActionCardFooter className="flex-wrap gap-2">
          {mode === null ? (
            <>
              <Button size="sm" onClick={() => setMode("create")}>
                Create status report
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMode("link")}
              >
                Link existing
              </Button>
            </>
          ) : (
            <>
              {mode === "create" ? (
                <Button
                  size="sm"
                  disabled={
                    !pageId ||
                    !title.trim() ||
                    !message.trim() ||
                    create.isPending
                  }
                  onClick={() => createReport().catch(console.error)}
                >
                  Create and link
                </Button>
              ) : (
                <Button
                  size="sm"
                  disabled={!reportId || link.isPending}
                  onClick={() =>
                    toast.promise(
                      link.mutateAsync({
                        id: incident.id,
                        statusReportId: Number(reportId),
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
              )}
              <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
                Cancel
              </Button>
            </>
          )}
        </ActionCardFooter>
      )}
    </ActionCard>
  );
}
