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
import { useMutation } from "@tanstack/react-query";
import { formatDistanceStrict } from "date-fns";
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
  const linked = maintenance.window;
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
              disabled={!!linked}
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
              disabled={!!linked}
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
        <PropertyValue className="flex-wrap">
          {linked ? (
            <>
              <span className="truncate">
                Window {linked.title}:{" "}
                {maintenanceWindowModeLabels[linked.mode]}
              </span>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-7">
                    Unlink
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Unlink from the window?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The times stop following {linked.title}, and while it is
                      active this maintenance pauses the monitors behind its
                      components.
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
            </>
          ) : (
            <span className="truncate">
              {maintenanceWindowModeLabels.pause}
            </span>
          )}
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
