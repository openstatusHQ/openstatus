"use client";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import { useQuery } from "@tanstack/react-query";

import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { formatDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

/**
 * This list exists to say ingest is broken, not to browse alerts — a silently
 * dead-lettered payload is a page nobody got.
 */
export function DeadLettersCard() {
  const trpc = useTRPC();
  const { data: deadLetters } = useQuery(
    trpc.alertSource.deadLetters.queryOptions({ limit: 50 }),
  );

  return (
    <FormCard>
      <FormCardHeader>
        <FormCardTitle>Unprocessed alerts</FormCardTitle>
        <FormCardDescription>
          Payloads we accepted but could not turn into an incident. The raw body
          is retained for 90 days so a fixed adapter can replay them.
        </FormCardDescription>
      </FormCardHeader>
      <FormCardContent>
        {!deadLetters || deadLetters.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>Nothing failed</EmptyStateTitle>
            <EmptyStateDescription>
              Every alert received has been processed.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Failed at</TableHead>
                <TableHead>Attempts</TableHead>
                <TableHead>Error</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deadLetters.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    {formatDate(new Date(entry.diedAt * 1000))}
                  </TableCell>
                  <TableCell>{entry.attempts}</TableCell>
                  <TableCell className="max-w-[420px] truncate font-mono text-xs">
                    {entry.finalError ?? "unknown"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </FormCardContent>
    </FormCard>
  );
}
