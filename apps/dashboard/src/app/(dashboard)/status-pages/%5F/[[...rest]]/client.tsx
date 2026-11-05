"use client";

import { StatusPage } from "@openstatus/icons";
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
  const { data: statusPages } = useQuery(trpc.page.list.queryOptions());

  if (!statusPages) return null;

  return (
    <PlaceholderPicker
      id="choose-status-page"
      title="Choose a status page"
      description="This link works for any status page. Pick the one to open."
      items={statusPages.map((page) => ({
        id: page.id,
        name: page.title,
        description: page.customDomain || `${page.slug}.openstatus.dev`,
      }))}
      empty={
        <EmptyStateContainer>
          <EmptyStateMedia>
            <StatusPage />
          </EmptyStateMedia>
          <EmptyStateTitle>No status pages yet</EmptyStateTitle>
          <EmptyStateDescription>
            Create a status page first, then open the link again.
          </EmptyStateDescription>
          <EmptyStateActions>
            <Button size="sm" asChild>
              <Link href="/status-pages/create">Create status page</Link>
            </Button>
          </EmptyStateActions>
        </EmptyStateContainer>
      }
    />
  );
}
