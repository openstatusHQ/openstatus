"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Badge } from "@openstatus/ui/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { Link } from "@/components/common/link";
import {
  EmptyStateContainer,
  EmptyStateDescription,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { QuickActions } from "@/components/dropdowns/quick-actions";
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

type Grant = RouterOutputs["oauth"]["listGrants"][number];

function scopeLabel(scope: Grant["scope"]): string {
  return scope.includes("write") ? "Read & write" : "Read-only";
}

function userLabel(user: Grant["user"]): string {
  if (!user) return "Removed user";
  const name = [user.firstName, user.lastName].filter(Boolean).join(" ");
  return name || user.email || `User ${user.id}`;
}

/** OAuth grants minted through `/oauth/authorize` (Claude, Cursor, ChatGPT and other MCP clients). */
export function ConnectedAppsCard() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const query = useQuery(trpc.oauth.listGrants.queryOptions());
  const grants = query.data ?? [];

  const revoke = useMutation(
    trpc.oauth.revokeGrant.mutationOptions({
      onSuccess: () =>
        queryClient.invalidateQueries({
          queryKey: trpc.oauth.listGrants.queryKey(),
        }),
    }),
  );

  return (
    <FormCard id="connected-apps">
      <FormCardHeader>
        <FormCardTitle>Connected apps</FormCardTitle>
        <FormCardDescription>
          MCP clients that members authorized with OAuth. Revoking signs the app
          out immediately.
        </FormCardDescription>
      </FormCardHeader>
      <FormCardContent>
        {query.isPending ? (
          <p className="text-muted-foreground text-sm">
            Loading connected apps…
          </p>
        ) : query.isError ? (
          <p className="text-destructive text-sm">
            Could not load connected apps. Reload the page to try again.
          </p>
        ) : grants.length === 0 ? (
          <EmptyStateContainer>
            <EmptyStateTitle>No connected apps</EmptyStateTitle>
            <EmptyStateDescription>
              Add the openstatus MCP server to Claude, Cursor or ChatGPT and
              approve the connection here.
            </EmptyStateDescription>
          </EmptyStateContainer>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>App</TableHead>
                  <TableHead>Access</TableHead>
                  <TableHead>Connected by</TableHead>
                  <TableHead>Connected</TableHead>
                  <TableHead>Last used</TableHead>
                  <TableHead>
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {grants.map((grant) => (
                  <TableRow key={grant.id}>
                    <TableCell className="font-medium">
                      {grant.clientName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {scopeLabel(grant.scope)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {userLabel(grant.user)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {grant.createdAt ? formatDate(grant.createdAt) : "-"}
                    </TableCell>
                    <TableCell className="text-sm">
                      {grant.lastUsedAt
                        ? formatDate(grant.lastUsedAt)
                        : "Never"}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <QuickActions
                          deleteAction={{
                            confirmationValue: grant.clientName,
                            submitAction: async () =>
                              await revoke.mutateAsync({ grantId: grant.id }),
                          }}
                        />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </FormCardContent>
      <FormCardFooter>
        <FormCardFooterInfo>
          Members can revoke their own connections; owners and admins can revoke
          any.{" "}
          <Link
            href="https://docs.openstatus.dev/reference/mcp-server"
            rel="noreferrer"
            target="_blank"
          >
            MCP server docs
          </Link>
          .
        </FormCardFooterInfo>
        <div />
      </FormCardFooter>
    </FormCard>
  );
}
