"use client";

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@openstatus/ui/components/ui/hover-card";
import { useState } from "react";

import { type EntityKind, entityKinds } from "@/data/entity-refs.client";
import { cn } from "@/lib/utils";

import { IncidentCard } from "./cards/incident";
import { MaintenanceCard } from "./cards/maintenance";
import { MonitorCard } from "./cards/monitor";
import { NotificationCard } from "./cards/notification";
import { PageCard } from "./cards/page";
import { PageComponentCard } from "./cards/page-component";
import { PrivateLocationCard } from "./cards/private-location";
import { StatusReportCard } from "./cards/status-report";

const cards = {
  page: PageCard,
  pageComponent: PageComponentCard,
  monitor: MonitorCard,
  statusReport: StatusReportCard,
  maintenance: MaintenanceCard,
  incident: IncidentCard,
  privateLocation: PrivateLocationCard,
  notification: NotificationCard,
} satisfies Record<EntityKind, React.ComponentType<{ id: number }>>;

/** An entity id that opens a card with the entity on hover, focus or tap. */
export function EntityRef({
  kind,
  id,
  children,
  className,
  ...props
}: Omit<React.ComponentProps<"button">, "id"> & {
  kind: EntityKind;
  id: number;
}) {
  const [open, setOpen] = useState(false);
  const Card = cards[kind];
  return (
    <HoverCard
      open={open}
      onOpenChange={setOpen}
      openDelay={150}
      closeDelay={100}
    >
      <HoverCardTrigger asChild>
        <button
          type="button"
          data-slot="entity-ref"
          aria-label={children ? undefined : `${entityKinds[kind].label} ${id}`}
          onClick={() => setOpen(true)}
          className={cn(
            "decoration-muted-foreground/50 data-[state=open]:decoration-foreground focus-visible:ring-ring/50 cursor-default rounded-xs font-mono tabular-nums underline decoration-dashed underline-offset-2 transition-[text-decoration-color] ease-[ease] outline-none focus-visible:ring-[3px]",
            className,
          )}
          {...props}
        >
          {children ?? id}
        </button>
      </HoverCardTrigger>
      <HoverCardContent align="start" className="w-72 overflow-hidden p-0">
        <Card id={id} />
      </HoverCardContent>
    </HoverCard>
  );
}

/** A bare id, or an id shown by its label (e.g. a name the payload already has). */
export type EntityRefItem = number | { id: number; label: React.ReactNode };

export function EntityRefList({
  kind,
  refs,
  className,
  ...props
}: React.ComponentProps<"span"> & {
  kind: EntityKind;
  refs: readonly EntityRefItem[];
}) {
  return (
    <span
      data-slot="entity-ref-list"
      className={cn("inline-flex flex-wrap gap-y-1", className)}
      {...props}
    >
      {refs.map((ref, i) => {
        const { id, label } =
          typeof ref === "number" ? { id: ref, label: undefined } : ref;
        return (
          <span key={`${id}-${i}`}>
            <EntityRef kind={kind} id={id}>
              {label}
            </EntityRef>
            {i < refs.length - 1 ? (
              <span className="text-muted-foreground mr-2">,</span>
            ) : null}
          </span>
        );
      })}
    </span>
  );
}
