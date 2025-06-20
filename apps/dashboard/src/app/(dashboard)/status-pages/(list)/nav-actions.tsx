"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";

export function NavActions() {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: statusPages } = useQuery(trpc.page.list.queryOptions());

  if (!workspace || !statusPages) return null;

  const limitReached = statusPages.length >= workspace.limits["status-pages"];

  if (limitReached) {
    return (
      <Button size="sm" disabled={limitReached}>
        Create Status Page
      </Button>
    );
  }

  return (
    <Button size="sm" disabled={limitReached} asChild>
      <Link href="/status-pages/create">Create Status Page</Link>
    </Button>
  );
}
