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
import { isTRPCClientError } from "@trpc/client";
import { useState } from "react";
import { toast } from "sonner";

import { Link } from "@/components/common/link";
import { useTRPC } from "@/lib/trpc/client";

import { usePublicUpdate } from "./use-public-update";

type Incident = NonNullable<RouterOutputs["incident"]["get"]>;

function toastError(error: Error) {
  return isTRPCClientError(error) ? error.message : "Something went wrong";
}

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
  const [status, setStatus] = useState<string>(
    report.status === "resolved" ? "monitoring" : report.status,
  );
  const [message, setMessage] = useState("");
  const [notifySubscribers, setNotifySubscribers] = useState(canNotify);
  const update = usePublicUpdate(incident.id);
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
    const promise = update.post({
      statusReportId: report.id,
      status: parsed,
      message,
      notifySubscribers,
    });
    toast.promise(promise, {
      loading: "Posting public update...",
      success: "Public update posted",
      error: toastError,
    });
    await promise;
    setMessage("");
  }

  return (
    <div className="grid gap-3">
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-0.5">
          {report.pageId ? (
            <Link
              href={`/status-pages/${report.pageId}/status-reports/${report.id}`}
              className="font-medium"
            >
              {report.title}
            </Link>
          ) : (
            <span className="font-medium">{report.title}</span>
          )}
          <span className="text-muted-foreground font-mono text-xs capitalize">
            {report.status}
          </span>
        </div>
        {closed ? null : (
          <Button
            variant="ghost"
            size="sm"
            disabled={unlink.isPending}
            onClick={() => unlink.mutate({ id: incident.id })}
          >
            Unlink
          </Button>
        )}
      </div>
      <div className="grid gap-2">
        <Label>Post public update</Label>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger size="sm" className="font-mono capitalize">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {statusReportStatus.map((s) => (
              <SelectItem key={s} value={s} className="capitalize">
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
          <div className="flex items-center gap-2">
            <Checkbox
              id="incident-report-notify"
              checked={notifySubscribers}
              onCheckedChange={(checked) =>
                setNotifySubscribers(checked === true)
              }
            />
            <Label htmlFor="incident-report-notify">Notify subscribers</Label>
          </div>
        ) : null}
        <Button
          size="sm"
          disabled={!message.trim() || update.isPending}
          onClick={() => post().catch(console.error)}
        >
          Post public update
        </Button>
      </div>
    </div>
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
  const { data: reports } = useQuery(
    trpc.statusReport.list.queryOptions({ order: "desc" }),
  );
  const { data: pages } = useQuery(trpc.page.list.queryOptions());
  const [mode, setMode] = useState<"link" | "create" | null>(null);
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

  if (incident.closedAt !== null) {
    return (
      <p className="text-muted-foreground text-sm">No status report linked.</p>
    );
  }

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
      error: toastError,
    });
    await promise;
    setMode(null);
  }

  const openReports = (reports ?? []).filter((r) => r.status !== "resolved");

  return (
    <div className="grid gap-3">
      <p className="text-muted-foreground text-sm">
        No status report yet. Your users only see what you publish there.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={mode === "create" ? "default" : "outline"}
          onClick={() => setMode("create")}
        >
          Create status report
        </Button>
        <Button
          size="sm"
          variant={mode === "link" ? "default" : "outline"}
          onClick={() => setMode("link")}
        >
          Link existing
        </Button>
      </div>
      {mode === "link" ? (
        <div className="grid gap-2">
          <Select value={reportId} onValueChange={setReportId}>
            <SelectTrigger size="sm">
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
                  error: toastError,
                },
              )
            }
          >
            Link
          </Button>
        </div>
      ) : null}
      {mode === "create" ? (
        <div className="grid gap-2">
          <Select value={pageId} onValueChange={setPageId}>
            <SelectTrigger size="sm">
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
          <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          <Textarea
            rows={3}
            placeholder="First public message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          {canNotify ? (
            <div className="flex items-center gap-2">
              <Checkbox
                id="incident-create-notify"
                checked={notifySubscribers}
                onCheckedChange={(checked) =>
                  setNotifySubscribers(checked === true)
                }
              />
              <Label htmlFor="incident-create-notify">Notify subscribers</Label>
            </div>
          ) : null}
          <Button
            size="sm"
            disabled={
              !pageId || !title.trim() || !message.trim() || create.isPending
            }
            onClick={() => createReport().catch(console.error)}
          >
            Create and link
          </Button>
        </div>
      ) : null}
    </div>
  );
}
