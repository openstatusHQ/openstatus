"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Copy, Refresh } from "@openstatus/icons";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import {
  HEARTBEAT_GRACE_RANGE,
  HEARTBEAT_PERIOD_RANGE,
} from "@openstatus/utils";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Link } from "@/components/common/link";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardFooterInfo,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "@/components/forms/form-card";

import { HeartbeatDurationInput } from "./heartbeat-duration-input";

export const heartbeatPeriodSchema = z
  .number({ error: "Period is required" })
  .int()
  .min(HEARTBEAT_PERIOD_RANGE.min, "At least 1 minute")
  .max(HEARTBEAT_PERIOD_RANGE.max, "At most 30 days");
export const heartbeatGraceSchema = z
  .number({ error: "Grace period is required" })
  .int()
  .min(HEARTBEAT_GRACE_RANGE.min, "At least 1 minute")
  .max(HEARTBEAT_GRACE_RANGE.max, "At most 7 days");

const schema = z.object({
  heartbeatPeriod: heartbeatPeriodSchema,
  heartbeatGrace: heartbeatGraceSchema,
});

type FormValues = z.input<typeof schema>;

export function heartbeatSnippets(pingUrl: string) {
  return {
    curl: `curl -fsS -m 10 --retry 3 ${pingUrl}`,
    crontab: `0 * * * * /path/to/job.sh && curl -fsS -m 10 --retry 3 ${pingUrl}`,
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
          Send a GET, POST or HEAD request when your job finishes. A POST body
          (up to 10 KB) is kept with the ping for debugging.
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
  defaultValues,
  pingUrl,
  onSubmit,
  onRegenerateToken,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues: FormValues;
  pingUrl: string | null;
  onSubmit: (values: FormValues) => Promise<void>;
  onRegenerateToken: () => Promise<void>;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues,
  });
  const [isPending, startTransition] = useTransition();

  function submitAction(values: FormValues) {
    if (isPending) return;
    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: "Saved",
          error: "Failed to save",
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)} {...props}>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Heartbeat</FormCardTitle>
            <FormCardDescription>
              How often your job pings, and how late a ping can be before the
              monitor goes down.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="heartbeatPeriod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Expected every</FormLabel>
                  <FormControl>
                    <HeartbeatDurationInput
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                  <FormDescription>The schedule of your job.</FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="heartbeatGrace"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Grace period</FormLabel>
                  <FormControl>
                    <HeartbeatDurationInput
                      value={field.value}
                      onChange={field.onChange}
                    />
                  </FormControl>
                  <FormMessage />
                  <FormDescription>
                    Extra time before a late ping counts as missed.
                  </FormDescription>
                </FormItem>
              )}
            />
          </FormCardContent>
          {pingUrl ? (
            <>
              <FormCardSeparator />
              <FormCardContent className="grid gap-4">
                <HeartbeatPingUrl pingUrl={pingUrl} />
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={regenerate}
                    disabled={isPending}
                  >
                    <Refresh size={16} />
                    Regenerate ping URL
                  </Button>
                </div>
              </FormCardContent>
            </>
          ) : null}
          <FormCardFooter>
            <FormCardFooterInfo>
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
            <Button type="submit" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit"}
            </Button>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
