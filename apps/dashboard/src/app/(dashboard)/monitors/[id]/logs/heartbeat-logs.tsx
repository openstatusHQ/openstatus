"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@openstatus/ui/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import { useInfiniteQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useState } from "react";

import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  Section,
  SectionDescription,
  SectionGroup,
  SectionHeader,
  SectionTitle,
} from "@/components/content/section";
import { useTRPC } from "@/lib/trpc/client";

type Ping = NonNullable<
  RouterOutputs["monitor"]["heartbeatPings"]
>["data"][number];

const PAGE_SIZE = 50;

function PingKind({ kind }: { kind: Ping["kind"] }) {
  return kind === "fail" ? (
    <Badge variant="destructive">Failed</Badge>
  ) : (
    <Badge variant="outline">Success</Badge>
  );
}

function PingDetail({ ping }: { ping: Ping }) {
  const headers = Object.entries(ping.headers);
  return (
    <div className="grid gap-4 p-4 text-sm">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-muted-foreground">Received</dt>
        <dd className="font-mono">{new Date(ping.timestamp).toISOString()}</dd>
        <dt className="text-muted-foreground">Result</dt>
        <dd>
          <PingKind kind={ping.kind} />
        </dd>
        <dt className="text-muted-foreground">Method</dt>
        <dd className="font-mono">{ping.method}</dd>
        <dt className="text-muted-foreground">IP</dt>
        <dd className="font-mono">{ping.ip ?? "—"}</dd>
        <dt className="text-muted-foreground">User agent</dt>
        <dd className="font-mono break-all">{ping.userAgent ?? "—"}</dd>
      </dl>
      <div className="grid gap-1.5">
        <span className="font-medium">Headers</span>
        {headers.length === 0 ? (
          <span className="text-muted-foreground">None</span>
        ) : (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            {headers.map(([name, value]) => (
              <div key={name} className="contents">
                <dt className="text-muted-foreground font-mono">{name}</dt>
                <dd className="font-mono break-all">{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="grid gap-1.5">
        <div className="flex items-center gap-2">
          <span className="font-medium">Body</span>
          {ping.bodyTruncated ? (
            <Badge variant="outline">truncated at 10 KB</Badge>
          ) : null}
        </div>
        {ping.body ? (
          <pre className="bg-muted max-h-96 overflow-auto rounded-md p-2 font-mono text-xs whitespace-pre-wrap">
            {ping.body}
          </pre>
        ) : (
          <span className="text-muted-foreground">Empty</span>
        )}
      </div>
    </div>
  );
}

export function HeartbeatLogs({ monitorId }: { monitorId: number }) {
  const trpc = useTRPC();
  const [selected, setSelected] = useState<Ping | null>(null);
  const { data, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } =
    useInfiniteQuery(
      trpc.monitor.heartbeatPings.infiniteQueryOptions(
        { id: monitorId, limit: PAGE_SIZE },
        { getNextPageParam: (page) => page?.nextCursor ?? undefined },
      ),
    );
  const pings = data?.pages.flatMap((page) => page?.data ?? []) ?? [];

  return (
    <SectionGroup>
      <Section>
        <SectionHeader>
          <SectionTitle>Pings</SectionTitle>
          <SectionDescription>
            Every ping your job sent, newest first. Secrets in headers are
            redacted.
          </SectionDescription>
        </SectionHeader>
        {!isLoading && pings.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No pings yet</EmptyStateTitle>
            <EmptyStateDescription>
              Pings show up here once your job calls its ping URL.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Received</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>User agent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pings.map((ping) => (
                <TableRow
                  key={ping.id}
                  className="cursor-pointer"
                  onClick={() => setSelected(ping)}
                >
                  <TableCell className="font-mono">
                    {format(new Date(ping.timestamp), "LLL dd, HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    <PingKind kind={ping.kind} />
                  </TableCell>
                  <TableCell className="font-mono">{ping.method}</TableCell>
                  <TableCell className="font-mono">{ping.ip ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground max-w-64 truncate">
                    {ping.userAgent ?? "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {hasNextPage ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? "Loading..." : "Load more"}
          </Button>
        ) : null}
      </Section>
      <Sheet
        open={selected !== null}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <SheetContent className="overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Ping</SheetTitle>
            <SheetDescription>
              {selected ? new Date(selected.timestamp).toLocaleString() : null}
            </SheetDescription>
          </SheetHeader>
          {selected ? <PingDetail ping={selected} /> : null}
        </SheetContent>
      </Sheet>
    </SectionGroup>
  );
}
