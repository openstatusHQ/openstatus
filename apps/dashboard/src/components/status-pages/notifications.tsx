"use client";

import { Skeleton } from "@openstatus/ui/components/ui/skeleton";
import { useQuery } from "@tanstack/react-query";

import { Link } from "@/components/common/link";
import {
  Property,
  PropertyLabel,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";
import { TableCellEmpty } from "@/components/data-table/table-cell-empty";
import { useTRPC } from "@/lib/trpc/client";

/** Who gets told when something is published on the page. */
export function Notifications({ pageId }: { pageId: number }) {
  const trpc = useTRPC();
  const {
    data: subscribers,
    isPending,
    isError,
  } = useQuery(trpc.pageSubscriber.list.queryOptions({ pageId }));
  const active =
    subscribers?.filter(
      (s) => s.acceptedAt !== null && s.unsubscribedAt === null,
    ) ?? [];

  return (
    <PropertyList>
      <Property>
        <PropertyLabel>Subscribers</PropertyLabel>
        <PropertyValue>
          {isPending ? (
            <Skeleton className="h-4 w-8" />
          ) : isError ? (
            <TableCellEmpty>Unavailable</TableCellEmpty>
          ) : active.length > 0 ? (
            <Link
              href={`/status-pages/${pageId}/subscribers`}
              className="font-normal"
            >
              {active.length.toLocaleString()}
            </Link>
          ) : (
            <TableCellEmpty>No subscribers</TableCellEmpty>
          )}
        </PropertyValue>
      </Property>
    </PropertyList>
  );
}
