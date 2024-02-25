"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import type { Row } from "@tanstack/react-table";
import { MoreHorizontal } from "lucide-react";

import { selectIncidentSchema } from "@openstatus/db/src/schema";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@openstatus/ui";

import { toastAction } from "@/lib/toast";
import { api } from "@/trpc/client";

interface DataTableRowActionsProps<TData> {
  row: Row<TData>;
}

export function DataTableRowActions<TData>({
  row,
}: DataTableRowActionsProps<TData>) {
  const incident = selectIncidentSchema.parse(row.original);
  const router = useRouter();
  const [_isPending, startTransition] = React.useTransition();

  async function resolved() {
    startTransition(async () => {
      try {
        if (!incident.id) return;
        await api.incident.resolvedIncident.mutate({ id: incident.id });
        toastAction("success");
        router.refresh();
      } catch {
        toastAction("error");
      }
    });
  }

  async function acknowledge() {
    startTransition(async () => {
      try {
        // const { jobType, ...rest } = monitor;
        // if (!monitor.id) return;
        // await api.monitor.update.mutate({
        //   ...rest,
        //   active: !monitor.active,
        // });
        if (!incident.id) return;
        await api.incident.acknowledgeIncident.mutate({ id: incident.id });
        toastAction("success");
        router.refresh();
      } catch {
        toastAction("error");
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="data-[state=open]:bg-accent h-8 w-8 p-0"
        >
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem
          disabled={incident.acknowledgedAt !== null}
          onClick={acknowledge}
        >
          Acknowledge
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={
            incident.resolvedAt !== null || incident.acknowledgedAt === null
          }
          onClick={resolved}
        >
          Resolved
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
