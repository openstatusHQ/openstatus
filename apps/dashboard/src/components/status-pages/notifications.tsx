"use client";

import { ArrowUpRight } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";

import { Link } from "@/components/common/link";
import { StatusDot } from "@/components/common/status-dot";
import {
  ActionCard,
  ActionCardDescription,
  ActionCardFooter,
  ActionCardHeader,
  ActionCardTitle,
} from "@/components/content/action-card";
import {
  Property,
  PropertyLabel,
  PropertyList,
  PropertyValue,
} from "@/components/content/property-list";
import { useTRPC } from "@/lib/trpc/client";

/** Subscriber count plus the "it is live" card for anything published on a page. */
export function Notifications({
  pageId,
  publicUrl,
  description,
}: {
  pageId: number;
  publicUrl: string;
  description: string;
}) {
  const trpc = useTRPC();
  const { data: subscribers } = useQuery(
    trpc.pageSubscriber.list.queryOptions({ pageId }),
  );
  const active = subscribers?.filter(
    (s) => s.acceptedAt !== null && s.unsubscribedAt === null,
  );

  return (
    <div className="flex flex-col gap-3">
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
      <ActionCard className="border-dashed">
        <ActionCardHeader>
          <ActionCardTitle className="flex items-center gap-2 text-sm">
            <StatusDot variant="success" />
            Published
          </ActionCardTitle>
          <ActionCardDescription>{description}</ActionCardDescription>
        </ActionCardHeader>
        <ActionCardFooter>
          <Button size="sm" variant="outline" asChild>
            <Link href={publicUrl} className="font-normal">
              View on status page
              <ArrowUpRight />
            </Link>
          </Button>
        </ActionCardFooter>
      </ActionCard>
    </div>
  );
}
