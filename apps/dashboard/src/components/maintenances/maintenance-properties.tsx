"use client";

import type { RouterOutputs } from "@openstatus/api";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@openstatus/ui/components/ui/alert-dialog";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@openstatus/ui/components/ui/dropdown-menu";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format, formatDistanceStrict } from "date-fns";
import { useState } from "react";
import { toast } from "sonner";

import { Link } from "@/components/common/link";
import { StatusDot } from "@/components/common/status-dot";
import { UserAvatar } from "@/components/common/user-avatar";
import {
  Property,
  PropertyDateTimePicker,
  PropertyLabel,
  PropertyLink,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";
import { distinctEditor } from "@/data/attribution.client";
import { maintenanceWindowModeLabels } from "@/data/maintenance-windows.client";
import {
  type MaintenanceStatus,
  maintenanceStatusConfig,
} from "@/data/overview-events.client";
import { useHydrated } from "@/hooks/use-hydrated";
import { useTRPC } from "@/lib/trpc/client";
import { errorMessage } from "@/lib/trpc/error";

import { useInvalidateMaintenance } from "./use-invalidate-maintenance";
import { useUpdateMaintenance } from "./use-update-maintenance";

type Maintenance = NonNullable<RouterOutputs["maintenance"]["get"]>;

function UserProperty({
  label,
  user,
}: {
  label: string;
  user: { name: string; photoUrl: string | null };
}) {
  return (
    <Property>
      <PropertyLabel>{label}</PropertyLabel>
      <PropertyValue>
        <UserAvatar name={user.name} src={user.photoUrl} />
        <span className="truncate">{user.name}</span>
      </PropertyValue>
    </Property>
  );
}

export function MaintenanceProperties({
  maintenance,
  page,
  status,
  publicUrl,
}: {
  maintenance: Maintenance;
  page: { id: number; title: string };
  status: MaintenanceStatus;
  publicUrl: string;
}) {
  // the formatted dates and the timezone are browser-local
  const hydrated = useHydrated();
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  // null = pristine: the pickers follow the server copy until edited.
  const [draft, setDraft] = useState<{ from: Date; to: Date } | null>(null);
  const from = draft?.from ?? maintenance.from;
  const to = draft?.to ?? maintenance.to;
  const { update, isPending } = useUpdateMaintenance(maintenance.id, {
    onSuccess: () => {
      toast.success("Schedule saved");
      setDraft(null);
    },
  });

  const dirty =
    draft !== null &&
    (from.getTime() !== maintenance.from.getTime() ||
      to.getTime() !== maintenance.to.getTime());
  const invalid = to <= from;
  const trpc = useTRPC();
  const invalidate = useInvalidateMaintenance(maintenance.id);
  const unlink = useMutation(
    trpc.maintenance.unlinkWindow.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success("Unlinked from the window");
      },
      onError: (error) => toast.error(errorMessage(error, "Failed to unlink")),
    }),
  );
  const link = useMutation(
    trpc.maintenance.linkWindow.mutationOptions({
      onSuccess: async () => {
        await invalidate();
        toast.success("Linked to the window");
      },
      onError: (error) => toast.error(errorMessage(error, "Failed to link")),
    }),
  );
  const { data: windows } = useQuery(
    trpc.maintenanceWindow.list.queryOptions(),
  );
  const linked = maintenance.window?.derived ? null : maintenance.window;
  const now = new Date();
  // an ended window has no checks left to follow
  const linkable = (windows ?? []).filter(
    (w) => w.derivedFrom === null && w.to > now,
  );
  const stamp = (date: Date) => format(date, "MMM d, HH:mm");
  const paused = maintenance.window?.derived
    ? maintenance.affectedMonitors.length
    : 0;
  const author = maintenance.createdByUser;
  const editor = distinctEditor(maintenance);

  return (
    <PropertyList>
      <Property>
        <PropertyLabel>Status</PropertyLabel>
        <PropertyValue>
          <StatusDot variant={maintenanceStatusConfig[status].variant} />
          {maintenanceStatusConfig[status].label}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Status page</PropertyLabel>
        <PropertyValue>
          <PropertyLink href={publicUrl}>{page.title}</PropertyLink>
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>From</PropertyLabel>
        <PropertyValue>
          {hydrated ? (
            <PropertyDateTimePicker
              aria-label="From"
              value={from}
              onChange={(date) => setDraft({ from: date, to })}
            />
          ) : (
            <div className="h-8" />
          )}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>To</PropertyLabel>
        <PropertyValue className="flex-wrap">
          {hydrated ? (
            <PropertyDateTimePicker
              aria-label="To"
              value={to}
              onChange={(date) => setDraft({ from, to: date })}
            />
          ) : (
            <div className="h-8" />
          )}
          {dirty ? (
            <div className="grid w-full grid-cols-2 gap-1 font-sans">
              <Button
                size="sm"
                className="h-7"
                disabled={invalid || isPending}
                onClick={() => update({ startDate: from, endDate: to })}
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7"
                disabled={isPending}
                onClick={() => setDraft(null)}
              >
                Reset
              </Button>
              {invalid ? (
                <span className="text-destructive col-span-full text-xs">
                  End must be after start
                </span>
              ) : null}
            </div>
          ) : null}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Checks</PropertyLabel>
        <PropertyValue className="flex-wrap justify-between font-sans">
          <span className="min-w-0 py-1.5">
            {linked ? (
              <>
                Checks follow window{" "}
                <Link href="/maintenance-windows">{linked.title}</Link>{" "}
                <span className="text-muted-foreground">
                  ({maintenanceWindowModeLabels[linked.mode].toLowerCase()},{" "}
                  {hydrated
                    ? `${stamp(linked.from)} – ${stamp(linked.to)}`
                    : null}
                  )
                </span>
              </>
            ) : paused > 0 ? (
              `Paused for ${paused} ${paused === 1 ? "monitor" : "monitors"} while this maintenance runs`
            ) : (
              <span className="text-muted-foreground">
                No monitors are affected
              </span>
            )}
          </span>
          {linked ? (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 shrink-0">
                  Unlink
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Unlink from the window?</AlertDialogTitle>
                  <AlertDialogDescription>
                    {linked.title} keeps running as it is. This maintenance then
                    pauses the monitors behind its own components, if any, for
                    its own times.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => unlink.mutate({ id: maintenance.id })}
                  >
                    Unlink
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : linkable.length && status !== "completed" ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 shrink-0"
                  disabled={link.isPending}
                >
                  Link to a maintenance window
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="max-w-72">
                <DropdownMenuLabel className="text-muted-foreground text-xs font-normal">
                  That window alone then decides the checks.
                </DropdownMenuLabel>
                {linkable.map((w) => (
                  <DropdownMenuItem
                    key={w.id}
                    className="flex-col items-start gap-0"
                    onSelect={() =>
                      link.mutate({
                        id: maintenance.id,
                        monitorMaintenanceWindowId: w.id,
                      })
                    }
                  >
                    <span className="max-w-full truncate">{w.title}</span>
                    <span className="text-muted-foreground text-xs">
                      {maintenanceWindowModeLabels[w.mode]}, {stamp(w.from)} –{" "}
                      {stamp(w.to)}
                    </span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Monitors</PropertyLabel>
        <PropertyValue>
          {maintenance.affectedMonitors.length ? (
            <span className="truncate">
              {maintenance.affectedMonitors.map((m, i) => (
                <span key={m.id}>
                  {i > 0 ? ", " : null}
                  <Link href={`/monitors/${m.id}/maintenance`}>{m.name}</Link>
                </span>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">None</span>
          )}
        </PropertyValue>
      </Property>
      <Property>
        <PropertyLabel>Duration</PropertyLabel>
        <PropertyValue>
          {formatDistanceStrict(maintenance.from, maintenance.to)}
          {status === "in-progress" ? (
            <>
              <StatusDot variant="warning" className="size-1.5" />
              <span className="sr-only">in progress</span>
            </>
          ) : null}
        </PropertyValue>
      </Property>
      {author ? <UserProperty label="Created by" user={author} /> : null}
      {editor ? <UserProperty label="Edited by" user={editor} /> : null}
      <Property>
        <PropertyLabel>Timezone</PropertyLabel>
        <PropertyValue>
          <span className="truncate">{hydrated ? timezone : null}</span>
        </PropertyValue>
      </Property>
    </PropertyList>
  );
}
