"use client";

import { Badge } from "@openstatus/ui/components/ui/badge";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { formatDate } from "@/lib/formatter";
import { useTRPC } from "@/lib/trpc/client";

const PROVIDER_LABEL = {
  alertmanager: "Prometheus Alertmanager",
  grafana: "Grafana",
} as const;

export function AlertSourcesCard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: sources } = useQuery(trpc.alertSource.list.queryOptions());
  const { data: stats } = useQuery(trpc.alertSource.stats.queryOptions());

  const setActive = useMutation(
    trpc.alertSource.setActive.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.alertSource.list.queryKey(),
        });
      },
      onError: (error) => toast.error(error.message),
    }),
  );

  return (
    <FormCard>
      <FormCardHeader>
        <FormCardTitle>Alert sources</FormCardTitle>
        <FormCardDescription>
          Send alerts from Alertmanager or Grafana to{" "}
          <code className="font-mono text-xs">
            POST /v1/ingest/&lt;provider&gt;
          </code>{" "}
          with your workspace API key in the{" "}
          <code className="font-mono text-xs">x-openstatus-key</code> header. A
          source appears here on its first delivery.
        </FormCardDescription>
      </FormCardHeader>
      <FormCardContent>
        {!sources || sources.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No alert sources yet</EmptyStateTitle>
            <EmptyStateDescription>
              Point a webhook at the ingest endpoint and it will show up here.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Provider</TableHead>
                <TableHead>Last event</TableHead>
                <TableHead>Staleness window</TableHead>
                <TableHead>Status</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {sources.map((source) => (
                <TableRow key={source.id}>
                  <TableCell>
                    {PROVIDER_LABEL[source.provider] ?? source.provider}
                  </TableCell>
                  <TableCell>
                    {source.lastEventAt
                      ? formatDate(source.lastEventAt)
                      : "never"}
                  </TableCell>
                  <TableCell>
                    {source.config.stalenessWindowMinutes} min
                  </TableCell>
                  <TableCell>
                    <Badge variant={source.active ? "secondary" : "outline"}>
                      {source.active ? "active" : "paused"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={setActive.isPending}
                      onClick={() =>
                        setActive.mutate({
                          id: source.id,
                          active: !source.active,
                        })
                      }
                    >
                      {source.active ? "Pause" : "Resume"}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </FormCardContent>
      {stats && stats.ignored > 0 ? (
        <FormCardFooter>
          <FormCardFooterInfo>
            {stats.ignored} alert{stats.ignored === 1 ? "" : "s"} were kept but
            not processed because this workspace is over its alert-source limit.
            Upgrading processes them retroactively.
          </FormCardFooterInfo>
        </FormCardFooter>
      ) : null}
    </FormCard>
  );
}
