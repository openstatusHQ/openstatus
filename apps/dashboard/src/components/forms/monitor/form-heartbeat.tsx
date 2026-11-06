"use client";

import { Check, Copy, Refresh } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { useTransition } from "react";
import { toast } from "sonner";

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

export function HeartbeatPingUrl({ pingUrl }: { pingUrl: string }) {
  const { copy, isCopied } = useCopyToClipboard();
  const snippets = heartbeatSnippets(pingUrl);

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
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
      <div className="grid gap-1.5">
        <span className="text-sm font-medium">Examples</span>
        {Object.entries(snippets).map(([label, snippet]) => (
          <div key={label} className="grid gap-1">
            <span className="text-muted-foreground text-xs">{label}</span>
            <pre className="bg-muted overflow-x-auto rounded-md p-2 font-mono text-xs">
              {snippet}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

export function FormHeartbeat({
  pingUrl,
  onRegenerateToken,
}: {
  pingUrl: string;
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
          success: "New ping URL ready. Update your job to use it.",
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
      <FormCardContent>
        <HeartbeatPingUrl pingUrl={pingUrl} />
      </FormCardContent>
      <FormCardFooter>
        <FormCardFooterInfo>
          Regenerating invalidates the current URL. Learn more about{" "}
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
          {isPending ? "Regenerating..." : "Regenerate"}
        </Button>
      </FormCardFooter>
    </FormCard>
  );
}
