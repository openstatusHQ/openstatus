import { ArrowUpRight } from "@openstatus/icons";
import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import type { UseQueryResult } from "@tanstack/react-query";
import NextLink from "next/link";

import {
  EntityCard,
  EntityCardContent,
  EntityCardHeader,
  EntityCardRow,
  EntityCardTitle,
} from "@/components/common/entity-card";
import { type EntityKind, entityKinds } from "@/data/entity-refs.client";
import { formatDateTime, formatDistanceToNowShort } from "@/lib/formatter";
import { isExpectedNotFound } from "@/lib/trpc/error";

/** Options for a `get` lookup: a 404 is the not-found card, not a bug. */
export const lookupOptions = {
  retry: false,
  meta: { expectNotFound: true },
  trpc: { context: { expectNotFound: true } },
} as const;

/** Kind icon and title; with `href` the title opens the entity in a new tab. */
export function EntityRefHeader({
  kind,
  href,
  children,
}: {
  kind: EntityKind;
  href?: string;
  children: React.ReactNode;
}) {
  const Icon = entityKinds[kind].icon;
  return (
    <EntityCardHeader>
      <Icon />
      {href ? (
        <NextLink
          href={href}
          target="_blank"
          rel="noopener"
          className="group/link focus-visible:ring-ring/50 flex min-w-0 flex-1 items-start gap-2 rounded-xs outline-none focus-visible:ring-[3px]"
        >
          <EntityCardTitle>{children}</EntityCardTitle>
          <ArrowUpRight className="text-muted-foreground/60 group-hover/link:text-foreground mt-0.5 size-3.5 shrink-0 transition-colors ease-[ease]" />
        </NextLink>
      ) : (
        <EntityCardTitle>{children}</EntityCardTitle>
      )}
    </EntityCardHeader>
  );
}

/** Loading, not-found or failed state for a card whose query has no data. */
export function EntityRefFallback({
  kind,
  id,
  query,
}: {
  kind: EntityKind;
  id: number;
  query: Pick<
    UseQueryResult<unknown, unknown>,
    "isPending" | "isError" | "error"
  >;
}) {
  const Icon = entityKinds[kind].icon;
  if (query.isPending) {
    return (
      <EntityCard aria-busy="true">
        <EntityCardHeader>
          <Icon />
          <Skeleton className="h-4 w-32" />
        </EntityCardHeader>
        <EntityCardContent>
          <Skeleton className="h-4 w-14" />
          <Skeleton className="ml-auto h-4 w-24" />
          <Skeleton className="h-4 w-16" />
          <Skeleton className="ml-auto h-4 w-20" />
        </EntityCardContent>
      </EntityCard>
    );
  }
  const failed = query.isError && !isExpectedNotFound(query.error, true);
  const { label } = entityKinds[kind];
  return (
    <EntityCard>
      <EntityCardHeader>
        <Icon />
        <EntityCardTitle className="text-muted-foreground">
          {failed
            ? `Couldn't load ${label.toLowerCase()}`
            : `${label} not found`}
        </EntityCardTitle>
      </EntityCardHeader>
      <EntityCardContent>
        <EntityCardRow label="ID">{id}</EntityCardRow>
        <EntityCardRow
          label="Reason"
          className="text-muted-foreground whitespace-normal"
        >
          {failed ? "Try again" : "Deleted or no access"}
        </EntityCardRow>
      </EntityCardContent>
    </EntityCard>
  );
}

export function RelativeTime({ date }: { date: Date }) {
  return (
    <time dateTime={date.toISOString()} title={formatDateTime(date)}>
      {formatDistanceToNowShort(date)}
    </time>
  );
}
