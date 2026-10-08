"use client";

import type { RouterOutputs } from "@openstatus/api";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  RadioGroup,
  RadioGroupItem,
} from "@openstatus/ui/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { useMutation, useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

import { searchParamsParsers } from "./search-params";

type Scope = "read" | "write";

// The page fetched the session server-side and hydrated it, so this query
// resolves from cache; the guard below only covers a stale or missing id.
export function Client() {
  const trpc = useTRPC();
  const [{ session: sessionId }] = useQueryStates(searchParamsParsers);
  const { data } = useQuery({
    ...trpc.oauth.getSession.queryOptions({ id: sessionId ?? "" }),
    enabled: Boolean(sessionId),
  });
  if (!sessionId || !data) return null;
  return <ConsentForm sessionId={sessionId} data={data} />;
}

function ConsentForm({
  sessionId,
  data,
}: {
  sessionId: string;
  data: RouterOutputs["oauth"]["getSession"];
}) {
  const trpc = useTRPC();
  const { clientName, clientOrigin, scope: requestedScope } = data.session;
  const { workspaces } = data;
  const requestedWrite = requestedScope.includes("write");
  const [workspaceId, setWorkspaceId] = useState<number | null>(
    workspaces[0]?.id ?? null,
  );
  const [scope, setScope] = useState<Scope>(requestedWrite ? "write" : "read");

  const decide = useMutation(
    trpc.oauth.decide.mutationOptions({
      onSuccess: ({ redirectUrl }) => {
        window.location.assign(redirectUrl);
      },
      onError: (error) => {
        toast.error(
          isTRPCClientError(error) ? error.message : "Something went wrong",
        );
      },
    }),
  );

  const approve = () => {
    if (workspaceId === null) return;
    decide.mutate({ id: sessionId, approved: true, workspaceId, scope });
  };
  const deny = () => decide.mutate({ id: sessionId, approved: false });
  const pending = decide.isPending ? decide.variables?.approved : undefined;

  if (workspaces.length === 0) {
    return (
      <div className="my-16 grid w-full max-w-lg gap-6 text-center">
        <h1 className="font-cal text-3xl tracking-tight">
          Create your first workspace
        </h1>
        <p className="font-commit-mono text-muted-foreground text-sm text-pretty">
          <strong>{clientName}</strong> needs a workspace to connect to. Create
          one, then start the connection again from your client.
        </p>
        <div className="flex justify-center gap-2">
          <Button asChild>
            <Link href="/onboarding">Create workspace</Link>
          </Button>
          <Button variant="outline" onClick={deny} disabled={decide.isPending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-16 grid w-full max-w-lg gap-6">
      <div className="flex flex-col gap-1 text-center">
        <h1 className="font-cal text-3xl tracking-tight">
          Connect {clientName}
        </h1>
        <p className="font-commit-mono text-muted-foreground text-sm text-pretty">
          <strong>{clientName}</strong> wants to access your openstatus
          workspace through the MCP server.
        </p>
        {clientOrigin ? (
          <p className="font-commit-mono text-muted-foreground text-xs">
            Verified app from <strong>{clientOrigin}</strong>
          </p>
        ) : (
          <p className="font-commit-mono text-muted-foreground text-xs">
            Self-registered app. Check the name matches the client you are
            using.
          </p>
        )}
      </div>
      <div className="grid gap-4 p-4">
        <div className="grid gap-2">
          <label htmlFor="workspace" className="text-sm font-medium">
            Workspace
          </label>
          <Select
            value={workspaceId === null ? "" : String(workspaceId)}
            onValueChange={(value) => setWorkspaceId(Number(value))}
          >
            <SelectTrigger id="workspace" className="w-full">
              <SelectValue placeholder="Select a workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={String(ws.id)}>
                  {ws.slug}
                  {ws.name ? (
                    <span className="text-muted-foreground"> ({ws.name})</span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <p id="oauth-scope-label" className="text-sm font-medium">
            Access
          </p>
          <RadioGroup
            aria-labelledby="oauth-scope-label"
            value={scope}
            onValueChange={(value) => setScope(value as Scope)}
            className="gap-3"
          >
            <label className="hover:bg-muted/40 has-[[aria-checked=true]]:border-primary flex cursor-pointer items-start gap-3 rounded-md border p-3">
              <RadioGroupItem value="read" className="mt-1" />
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Read-only</div>
                <div className="text-muted-foreground text-xs">
                  List monitors, pages and incidents. Nothing changes.
                </div>
              </div>
            </label>
            <label
              className="hover:bg-muted/40 has-[[aria-checked=true]]:border-primary flex cursor-pointer items-start gap-3 rounded-md border p-3 aria-disabled:cursor-not-allowed aria-disabled:opacity-60"
              aria-disabled={!requestedWrite}
            >
              <RadioGroupItem
                value="write"
                className="mt-1"
                disabled={!requestedWrite}
              />
              <div className="space-y-0.5">
                <div className="text-sm font-medium">Read &amp; write</div>
                <div className="text-muted-foreground text-xs">
                  {requestedWrite
                    ? "Create and update monitors, status reports and more."
                    : "Not requested by this client."}
                </div>
              </div>
            </label>
          </RadioGroup>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" onClick={deny} disabled={decide.isPending}>
            {pending === false ? "Cancelling…" : "Deny"}
          </Button>
          <Button
            onClick={approve}
            disabled={decide.isPending || workspaceId === null}
          >
            {pending === true ? "Connecting…" : "Approve"}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground mx-auto max-w-md px-8 text-center text-xs text-pretty">
        You can revoke this connection any time from{" "}
        <code>Settings / Integrations</code>.
      </p>
    </div>
  );
}
