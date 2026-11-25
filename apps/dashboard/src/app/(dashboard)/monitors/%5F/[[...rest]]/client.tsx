"use client";

import { Monitor } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";

import { PlaceholderPicker } from "@/components/common/placeholder-picker";
import {
  EmptyStateActions,
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { useTRPC } from "@/lib/trpc/client";

export function Client() {
  const trpc = useTRPC();
  const {
    data: monitors,
    errorUpdateCount,
    isFetching,
    refetch,
  } = useQuery(trpc.monitor.list.queryOptions());

  return (
    <PlaceholderPicker
      id="choose-monitor"
      title="Choose a monitor"
      description="This link works for any monitor. Pick the one to open."
      // A retry after a failed first load resets `isError`; the error count
      // doesn't, so the error card stays up while the retry runs.
      error={!monitors && errorUpdateCount > 0}
      retrying={isFetching}
      onRetry={() => void refetch()}
      items={monitors?.map((monitor) => ({
        id: monitor.id,
        name: monitor.name || "Untitled monitor",
        description: monitor.url || undefined,
      }))}
      empty={
        <EmptyStateContainer>
          <EmptyStateMedia>
            <Monitor />
          </EmptyStateMedia>
          <EmptyStateTitle>No monitors yet</EmptyStateTitle>
          <EmptyStateDescription>
            Create a monitor first, then open the link again.
          </EmptyStateDescription>
          <EmptyStateActions>
            <Button size="sm" asChild>
              <Link href="/monitors/create">Create monitor</Link>
            </Button>
          </EmptyStateActions>
        </EmptyStateContainer>
      }
    />
  );
}
