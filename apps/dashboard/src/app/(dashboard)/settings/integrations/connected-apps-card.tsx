"use client";

import { ExternalLink, Plug } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import NextLink from "next/link";

import { Link } from "@/components/common/link";
import {
  EmptyStateActions,
  EmptyStateDescription,
  EmptyStateMedia,
  EmptyStateTitle,
} from "@/components/content/empty-state";
import { columns } from "@/components/data-table/settings/connected-apps/columns";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";
import { DataTable } from "@/components/ui/data-table/data-table";
import { DataTableEmpty } from "@/components/ui/data-table/data-table-empty";
import { DataTablePaginationSimple } from "@/components/ui/data-table/data-table-pagination";
import { useTRPC } from "@/lib/trpc/client";

/** OAuth grants minted through `/oauth/authorize` (Claude, Cursor, ChatGPT and other MCP clients). */
export function ConnectedAppsCard() {
  const trpc = useTRPC();
  const query = useQuery(trpc.oauth.listGrants.queryOptions());
  const grants = query.data ?? [];

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
        ) : (
          <DataTable
            columns={columns}
            data={grants}
            paginationComponent={DataTablePaginationSimple}
            emptyState={
              <DataTableEmpty>
                <EmptyStateMedia>
                  <Plug />
                </EmptyStateMedia>
                <EmptyStateTitle>No connected apps yet</EmptyStateTitle>
                <EmptyStateDescription>
                  Add the openstatus MCP server to Claude, Cursor or ChatGPT and
                  approve the connection here.
                </EmptyStateDescription>
                <EmptyStateActions>
                  <Button size="sm" variant="outline" asChild>
                    <NextLink
                      href="https://docs.openstatus.dev/reference/mcp-server"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink />
                      MCP server docs
                    </NextLink>
                  </Button>
                </EmptyStateActions>
              </DataTableEmpty>
            }
          />
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
