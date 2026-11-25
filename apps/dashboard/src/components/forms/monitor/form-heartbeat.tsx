"use client";

import { Check, Copy, Refresh } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { useTransition } from "react";
import { toast } from "sonner";

import { Code } from "@/components/common/code";
import { Link } from "@/components/common/link";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardTitle,
} from "@/components/forms/form-card";

export function heartbeatSnippets(pingUrl: string) {
  return {
    curl: `curl -fsS -m 10 --retry 3 ${pingUrl}`,
    crontab: `0 * * * * /path/to/job.sh && curl -fsS -m 10 --retry 3 ${pingUrl}`,
    "report failures": `/path/to/job.sh && curl -fsS -m 10 --retry 3 ${pingUrl} || curl -fsS -m 10 --retry 3 ${pingUrl}/fail`,
  };
}

function HeartbeatPingUrl({ pingUrl }: { pingUrl: string }) {
  const { copy, isCopied } = useCopyToClipboard();
  const snippets = heartbeatSnippets(pingUrl);

  return (
    <div className="grid grid-cols-1 gap-3">
      <div className="grid grid-cols-1 gap-1.5">
        <span className="text-sm font-medium">Ping URL</span>
        <Button
          type="button"
          variant="outline"
          className="justify-between font-mono text-xs"
          onClick={() =>
            copy(pingUrl, { successMessage: "Copied ping URL to clipboard" })
          }
        >
          <span className="truncate">{pingUrl}</span>
          {isCopied ? (
            <Check size={16} className="text-muted-foreground" />
          ) : (
            <Copy size={16} className="text-muted-foreground" />
          )}
        </Button>
        <p className="text-muted-foreground text-sm">
          Send a GET, POST or HEAD request when your job finishes, or to the
          same URL ending in <code className="font-mono">/fail</code> when it
          fails: the monitor goes down within a minute and recovers on the next
          ping. A POST body (up to 10 KB) is kept with the ping for debugging.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-1.5">
        <span className="text-sm font-medium">Examples</span>
        <ul className="flex flex-col gap-2">
          {Object.entries(snippets).map(([label, snippet]) => (
            <li key={label} className="flex flex-col gap-0.5">
              <p className="text-muted-foreground text-xs">{label}</p>
              <Code>{snippet}</Code>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function FormHeartbeat({
  pingUrl,
  onRegenerateToken,
}: {
  pingUrl: string | null;
  onRegenerateToken: () => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();

  function regenerate() {
    if (isPending) return;
    startTransition(async () => {
      try {
        const promise = onRegenerateToken();
        toast.promise(promise, {
          loading: "Regenerating...",
          success: pingUrl
            ? "New ping URL ready. Update your job to use it."
            : "Ping URL ready. Add it to your job.",
          error: "Failed to regenerate the ping URL",
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <FormCard id="heartbeat">
      <FormCardHeader>
        <FormCardTitle>Ping URL</FormCardTitle>
        <FormCardDescription>
          The unique URL your job calls when it finishes.
        </FormCardDescription>
      </FormCardHeader>
      {pingUrl ? (
        <FormCardContent>
          <HeartbeatPingUrl pingUrl={pingUrl} />
        </FormCardContent>
      ) : null}
      <FormCardFooter>
        <FormCardFooterInfo>
          {pingUrl
            ? "Regenerating invalidates the current URL."
            : "This monitor has no ping URL yet."}{" "}
          Learn more about{" "}
          <Link
            href="https://www.openstatus.dev/docs/reference/heartbeat-monitor/"
            rel="noreferrer"
            target="_blank"
          >
            heartbeat monitors
          </Link>
          .
        </FormCardFooterInfo>
        <Button
          type="button"
          variant="outline"
          onClick={regenerate}
          disabled={isPending}
        >
          <Refresh size={16} />
          {pingUrl
            ? isPending
              ? "Regenerating..."
              : "Regenerate"
            : isPending
              ? "Generating..."
              : "Generate"}
        </Button>
      </FormCardFooter>
    </FormCard>
  );
}
