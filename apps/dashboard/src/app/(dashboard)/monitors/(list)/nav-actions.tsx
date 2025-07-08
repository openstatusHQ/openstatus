"use client";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { NavFeedback } from "@/components/nav/nav-feedack";

export function NavActions() {
  const trpc = useTRPC();
  const { data: workspace } = useQuery(trpc.workspace.get.queryOptions());
  const { data: monitors } = useQuery(trpc.monitor.list.queryOptions());

  if (!workspace || !monitors) return null;

  const limitReached = monitors.length >= workspace.limits["monitors"];

  return (
    <div className="flex items-center gap-2 text-sm">
      <NavFeedback />
      {limitReached ? (
        <Button size="sm" disabled={limitReached}>
          Create Monitor
        </Button>
      ) : (
        <Button size="sm" disabled={limitReached} asChild>
          <Link href="/monitors/create">Create Monitor</Link>
        </Button>
      )}
    </div>
  );
}
