"use client";

import { useQuery } from "@tanstack/react-query";

import { Link } from "@/components/common/link";
import {
  Property,
  PropertyLabel,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";
import { useTRPC } from "@/lib/trpc/client";

/** Who gets told when something is published on the page. */
export function Notifications({ pageId }: { pageId: number }) {
  const trpc = useTRPC();
  const { data: subscribers } = useQuery(
    trpc.pageSubscriber.list.queryOptions({ pageId }),
  );
  const active = subscribers?.filter(
    (s) => s.acceptedAt !== null && s.unsubscribedAt === null,
  );

  return (
    <PropertyList>
      <Property>
        <PropertyLabel>Subscribers</PropertyLabel>
        <PropertyValue>
          {active ? (
            <Link
              href={`/status-pages/${pageId}/subscribers`}
              className="font-normal"
            >
              {active.length.toLocaleString()}
            </Link>
          ) : (
            <span className="text-muted-foreground">–</span>
          )}
        </PropertyValue>
      </Property>
    </PropertyList>
  );
}
