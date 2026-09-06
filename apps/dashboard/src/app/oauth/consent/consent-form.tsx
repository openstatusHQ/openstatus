"use client";

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
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { useTRPC } from "@/lib/trpc/client";

type Scope = "read" | "write";

type Props = {
  sessionId: string;
  clientName: string;
  clientOrigin: string | null;
  requestedScope: string[];
  workspaces: { id: number; name: string | null; slug: string }[];
};

export function ConsentForm({
  sessionId,
  clientName,
  clientOrigin,
  requestedScope,
  workspaces,
}: Props) {
  const trpc = useTRPC();
  const requestedWrite = requestedScope.includes("write");
  const [workspaceId, setWorkspaceId] = useState<string>(
    workspaces[0] ? String(workspaces[0].id) : "",
  );
  const [scope, setScope] = useState<Scope>(requestedWrite ? "write" : "read");
  const [decision, setDecision] = useState<"approve" | "deny" | null>(null);

  const decide = useMutation(
    trpc.oauth.decide.mutationOptions({
      onSuccess: ({ redirectUrl }) => {
        window.location.assign(redirectUrl);
      },
      onError: (error) => {
        setDecision(null);
        toast.error(
          isTRPCClientError(error) ? error.message : "Something went wrong",
        );
      },
    }),
  );

  const approve = () => {
    setDecision("approve");
    decide.mutate({
      id: sessionId,
      approved: true,
      workspaceId: Number(workspaceId),
      scope,
    });
  };
  const deny = () => {
    setDecision("deny");
    decide.mutate({ id: sessionId, approved: false });
  };

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
          <Select value={workspaceId} onValueChange={setWorkspaceId}>
            <SelectTrigger id="workspace" className="w-full">
              <SelectValue placeholder="Select a workspace" />
            </SelectTrigger>
            <SelectContent>
              {workspaces.map((ws) => (
                <SelectItem key={ws.id} value={String(ws.id)}>
                  {ws.name || ws.slug}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <p className="text-sm font-medium">Access</p>
          <RadioGroup
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
            {decision === "deny" ? "Cancelling…" : "Deny"}
          </Button>
          <Button onClick={approve} disabled={decide.isPending || !workspaceId}>
            {decision === "approve" ? "Connecting…" : "Approve"}
          </Button>
        </div>
      </div>
      <p className="text-muted-foreground mx-auto max-w-md px-8 text-center text-xs text-pretty">
        You can revoke this connection any time from Settings → Integrations.
      </p>
    </div>
  );
}
