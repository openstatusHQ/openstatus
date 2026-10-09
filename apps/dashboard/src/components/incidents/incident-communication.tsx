"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Add, ArrowUpRight, Linked, Send, Unlinked } from "@openstatus/icons";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@openstatus/ui/components/ui/command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@openstatus/ui/components/ui/popover";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import NextLink from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { Link } from "@/components/common/link";
import { StatusDot } from "@/components/common/status-dot";
import {
  Property,
  PropertyLabel,
  PropertyList,
  PropertyMenuTrigger,
  PropertyValue,
} from "@/components/content/property-list";
import { FormSheetStatusReportUpdateCreate } from "@/components/forms/status-report-update/sheet-create";
import { FormSheetStatusReportCreate } from "@/components/forms/status-report/sheet-create";
import { statusVariants } from "@/data/status-report-updates.client";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

type Incident = NonNullable<RouterOutputs["incident"]["get"]>;
type Report = NonNullable<Incident["statusReport"]>;

function slackChannelUrl(teamId: string, channelId: string): string {
  return `https://slack.com/app_redirect?team=${teamId}&channel=${channelId}`;
}

export function IncidentCommunication({ incident }: { incident: Incident }) {
  const report = incident.statusReport;
  return (
    <PropertyList>
      {report ? (
        <LinkedReport incident={incident} report={report} />
      ) : (
        <UnlinkedReport incident={incident} />
      )}
      <Property>
        <PropertyLabel>Slack</PropertyLabel>
        <PropertyValue>
          {incident.slackTeamId && incident.slackChannelId ? (
            <Link
              href={slackChannelUrl(
                incident.slackTeamId,
                incident.slackChannelId,
              )}
            >
              Open channel
            </Link>
          ) : (
            <span className="text-muted-foreground">No channel</span>
          )}
        </PropertyValue>
      </Property>
    </PropertyList>
  );
}

function LinkedReport({
  incident,
  report,
}: {
  incident: Incident;
  report: Report;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [composing, setComposing] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
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
  // The sheet needs components and past updates, which the incident
  // embeds only in part: fetched once the operator asks for it.
  const { data: fullReport } = useQuery({
    ...trpc.statusReport.get.queryOptions({ id: report.id }),
    enabled: composing,
  });

  return (
    <Property>
      <PropertyLabel>Status report</PropertyLabel>
      <PropertyValue>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <PropertyMenuTrigger>
              <StatusDot variant={statusVariants[report.status]} />
              <span className="truncate">{report.title}</span>
            </PropertyMenuTrigger>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[var(--radix-dropdown-menu-trigger-width)]"
          >
            <DropdownMenuItem onSelect={() => setComposing(true)}>
              <Send />
              Post public update
            </DropdownMenuItem>
            {report.pageId ? (
              <DropdownMenuItem asChild>
                <NextLink
                  href={`/status-pages/${report.pageId}/status-reports/${report.id}`}
                >
                  <ArrowUpRight />
                  Open report
                </NextLink>
              </DropdownMenuItem>
            ) : null}
            {closed ? null : (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={() => setConfirmUnlink(true)}
                >
                  <Unlinked />
                  Unlink
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </PropertyValue>
      {composing && fullReport ? (
        <FormSheetStatusReportUpdateCreate
          report={fullReport}
          open
          onOpenChange={setComposing}
        />
      ) : null}
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
    </Property>
  );
}

function UnlinkedReport({ incident }: { incident: Incident }) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [linking, setLinking] = useState(false);
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

  function linkReport(statusReportId: number) {
    setLinking(false);
    toast.promise(link.mutateAsync({ id: incident.id, statusReportId }), {
      loading: "Linking...",
      success: "Status report linked",
      error: (error) => errorMessage(error),
    });
  }

  return (
    <Property>
      <PropertyLabel>Status report</PropertyLabel>
      <PropertyValue>
        {closed ? (
          <span className="text-muted-foreground">Not published</span>
        ) : linking ? (
          <Popover open onOpenChange={(open) => !open && setLinking(false)}>
            <PopoverTrigger asChild>
              <PropertyMenuTrigger className="text-muted-foreground">
                Search status reports...
              </PropertyMenuTrigger>
            </PopoverTrigger>
            <PopoverContent
              align="start"
              className="w-[var(--radix-popover-trigger-width)] p-0"
            >
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
                        onSelect={() => linkReport(r.id)}
                      >
                        <StatusDot variant={statusVariants[r.status]} />
                        <span className="truncate">{r.title}</span>
                        <span className="text-muted-foreground ml-auto truncate text-xs">
                          {r.page.title}
                        </span>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        ) : (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <PropertyMenuTrigger className="text-muted-foreground">
                Not published
              </PropertyMenuTrigger>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              <DropdownMenuLabel className="text-muted-foreground font-normal whitespace-normal">
                Nothing here is public. Customers only see what you publish on
                your status page.
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setCreateOpen(true)}>
                <Add />
                Create status report
              </DropdownMenuItem>
              {linkable.length > 0 ? (
                <DropdownMenuItem onSelect={() => setLinking(true)}>
                  <Linked />
                  Link existing
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </PropertyValue>
      {/* Mounted on demand: the sheet fetches pages as soon as it renders. */}
      {createOpen ? (
        <FormSheetStatusReportCreate
          open
          onOpenChange={setCreateOpen}
          incidentId={incident.id}
          onCreated={() => refresh().catch(console.error)}
        />
      ) : null}
    </Property>
  );
}
