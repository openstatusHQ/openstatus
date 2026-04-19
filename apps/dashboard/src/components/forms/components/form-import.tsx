"use client";

import { Link } from "@/components/common/link";
import { Note } from "@/components/common/note";
import {
  FormCard,
  FormCardContent,
  FormCardDescription,
  FormCardFooter,
  FormCardHeader,
  FormCardSeparator,
  FormCardTitle,
} from "@/components/forms/form-card";
import { useTRPC } from "@/lib/trpc/client";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  BetterstackIcon,
  InstatusIcon,
  StatuspageIcon,
} from "@openstatus/icons";
import type { ImportSummary } from "@openstatus/importers/types";
import { Badge } from "@openstatus/ui/components/ui/badge";
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
import { Input } from "@openstatus/ui/components/ui/input";
import {
  RadioGroup,
  RadioGroupItem,
} from "@openstatus/ui/components/ui/radio-group";
import { Switch } from "@openstatus/ui/components/ui/switch";
import { useMutation } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { AlertTriangle } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  provider: z.enum(["statuspage", "betterstack", "instatus"]),
  apiKey: z.string().min(1, "API key is required"),
  statuspagePageId: z.string().optional(),
  betterstackStatusPageId: z.string().optional(),
  instatusPageId: z.string().optional(),
  includeMonitors: z.boolean(),
  includeStatusReports: z.boolean(),
  includeSubscribers: z.boolean(),
  includeComponents: z.boolean(),
});

export type ImportFormValues = z.input<typeof schema>;

function getPhaseCount(preview: ImportSummary, phase: string): number {
  return preview.phases.find((p) => p.phase === phase)?.resources.length ?? 0;
}

const PHASE_LABELS: Record<string, string> = {
  monitors: "Monitors",
  componentGroups: "Component Groups",
  monitorGroups: "Monitor Groups",
  sections: "Sections",
  components: "Components",
  incidents: "Status Reports",
  maintenances: "Maintenances",
  subscribers: "Subscribers",
};

export function FormImport({
  pageId,
  onSubmit,
}: {
  pageId: number;
  onSubmit: (values: ImportFormValues) => Promise<ImportSummary>;
}) {
  const form = useForm<ImportFormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      provider: undefined,
      apiKey: "",
      statuspagePageId: "",
      betterstackStatusPageId: "",
      instatusPageId: "",
      includeMonitors: true,
      includeStatusReports: true,
      includeSubscribers: false,
      includeComponents: true,
    },
  });
  const [isPending, startTransition] = useTransition();
  const trpc = useTRPC();
  const watchProvider = form.watch("provider");
  const watchApiKey = form.watch("apiKey");
  const watchStatuspagePageId = form.watch("statuspagePageId");
  const watchBetterstackStatusPageId = form.watch("betterstackStatusPageId");
  const watchInstatusPageId = form.watch("instatusPageId");

  const previewMutation = useMutation(
    trpc.import.preview.mutationOptions({
      onError: (error) => {
        if (isTRPCClientError(error)) {
          toast.error(error.message);
        } else {
          toast.error("Failed to preview import");
        }
      },
    }),
  );

  async function runPreview() {
    const apiKey = form.getValues("apiKey");
    if (!apiKey) {
      form.setError("apiKey", { message: "API key is required" });
      return;
    }
    previewMutation.mutate({
      provider: watchProvider,
      apiKey: watchApiKey,
      statuspagePageId:
        watchProvider === "statuspage"
          ? watchStatuspagePageId || undefined
          : undefined,
      betterstackStatusPageId:
        watchProvider === "betterstack"
          ? watchBetterstackStatusPageId || undefined
          : undefined,
      instatusPageId:
        watchProvider === "instatus"
          ? watchInstatusPageId || undefined
          : undefined,
      pageId,
    });
  }

  function submitAction(values: ImportFormValues) {
    if (isPending || !previewMutation.data) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Importing...",
          success: (result) => {
            if (result.status === "partial")
              return "Import completed with warnings";
            return "Import completed";
          },
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return "Import failed";
          },
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)}>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Import</FormCardTitle>
            <FormCardDescription>
              Import components, incidents, and subscribers from an external
              status page provider.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardSeparator />
          <FormCardContent>
            <FormField
              control={form.control}
              name="provider"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Provider</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-4 sm:grid-cols-4"
                    >
                      <FormItem className="relative flex cursor-pointer flex-row items-center gap-3 rounded-md border border-input px-2 py-3 text-center shadow-xs outline-none transition-[color,box-shadow] has-data-[state=checked]:border-primary/50 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
                        <FormControl>
                          <RadioGroupItem
                            value="statuspage"
                            className="sr-only"
                          />
                        </FormControl>
                        <StatuspageIcon
                          className="size-4 shrink-0 text-foreground"
                          aria-hidden="true"
                        />
                        <FormLabel className="cursor-pointer font-medium text-foreground text-xs leading-none after:absolute after:inset-0">
                          Atlassian Statuspage
                        </FormLabel>
                      </FormItem>
                      <FormItem className="relative flex cursor-pointer flex-row items-center gap-3 rounded-md border border-input px-2 py-3 text-center shadow-xs outline-none transition-[color,box-shadow] has-data-[state=checked]:border-primary/50 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
                        <FormControl>
                          <RadioGroupItem
                            value="betterstack"
                            className="sr-only"
                          />
                        </FormControl>
                        <BetterstackIcon
                          className="size-4 shrink-0 text-foreground"
                          aria-hidden="true"
                        />
                        <FormLabel className="cursor-pointer font-medium text-foreground text-xs leading-none after:absolute after:inset-0">
                          Better Stack
                        </FormLabel>
                      </FormItem>
                      <FormItem className="relative flex cursor-pointer flex-row items-center gap-3 rounded-md border border-input px-2 py-3 text-center shadow-xs outline-none transition-[color,box-shadow] has-data-[state=checked]:border-primary/50 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
                        <FormControl>
                          <RadioGroupItem
                            value="instatus"
                            className="sr-only"
                          />
                        </FormControl>
                        <InstatusIcon
                          className="size-4 shrink-0 text-foreground"
                          aria-hidden="true"
                        />
                        <FormLabel className="cursor-pointer font-medium text-foreground text-xs leading-none after:absolute after:inset-0">
                          Instatus
                        </FormLabel>
                      </FormItem>
                      <div className="col-span-1 self-end text-muted-foreground text-xs sm:place-self-end">
                        Missing a provider?{" "}
                        <a href="mailto:ping@openstatus.dev">Contact us</a>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormCardContent>
          {watchProvider ? (
            <>
              <FormCardSeparator />
              <FormCardContent className="grid gap-4">
                <FormField
                  control={form.control}
                  name="apiKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>API Key</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder={
                            watchProvider === "betterstack"
                              ? "Bearer token"
                              : watchProvider === "instatus"
                                ? "Bearer API key"
                                : "OAuth API key"
                          }
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      <FormDescription>
                        {watchProvider === "betterstack"
                          ? "Your Better Stack API token. Found in Better Stack > API tokens."
                          : watchProvider === "instatus"
                            ? "Your Instatus API key. Found in your Instatus account under Settings > API."
                            : "Your Statuspage API key. Found in your Statuspage account under Manage Account > API."}{" "}
                        <Link
                          href={
                            watchProvider === "betterstack"
                              ? "https://openstatus.dev/guides/migrate-from-betterstack"
                              : watchProvider === "instatus"
                                ? "https://openstatus.dev/guides/migrate-from-instatus"
                                : "https://openstatus.dev/guides/migrate-from-atlassian-statuspage"
                          }
                        >
                          Full migration guide.
                        </Link>
                      </FormDescription>
                    </FormItem>
                  )}
                />
                {watchProvider === "statuspage" ? (
                  <FormField
                    control={form.control}
                    name="statuspagePageId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Page ID (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. abc123def456" {...field} />
                        </FormControl>
                        <FormDescription>
                          Import a specific page. Leave empty to import across
                          pages.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                ) : null}
                {watchProvider === "betterstack" ? (
                  <FormField
                    control={form.control}
                    name="betterstackStatusPageId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status Page ID (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. 123456789" {...field} />
                        </FormControl>
                        <FormDescription>
                          Import a specific status page. Leave empty to use the
                          first available.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                ) : null}
                {watchProvider === "instatus" ? (
                  <FormField
                    control={form.control}
                    name="instatusPageId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Page ID (optional)</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g. clx1abc2def3" {...field} />
                        </FormControl>
                        <FormDescription>
                          Import a specific page. Leave empty to import all
                          pages.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                ) : null}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={runPreview}
                  disabled={previewMutation.isPending}
                >
                  {previewMutation.isPending
                    ? "Loading preview..."
                    : "Preview Import"}
                </Button>
              </FormCardContent>
            </>
          ) : null}
          {previewMutation.data ? (
            <>
              <FormCardSeparator />
              <FormCardContent className="grid gap-4">
                <div>
                  <FormLabel>Preview</FormLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(PHASE_LABELS).map(([key, label]) => {
                      const count = getPhaseCount(previewMutation.data, key);
                      if (count === 0) return null;
                      return (
                        <Badge key={key} variant="secondary">
                          {label}: {count}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                {previewMutation.data.errors.length > 0 ? (
                  <Note color="error" size="sm">
                    <AlertTriangle />
                    <p className="text-sm">
                      {previewMutation.data.errors.join(" ")}
                    </p>
                  </Note>
                ) : null}
                {watchProvider === "betterstack" ? (
                  <FormField
                    control={form.control}
                    name="includeMonitors"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Monitors</FormLabel>
                          <FormDescription>
                            Import monitors with their URL, frequency, and
                            regions.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ) : null}
                <FormField
                  control={form.control}
                  name="includeStatusReports"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel>Status Reports & Maintenances</FormLabel>
                        <FormDescription>
                          Import incidents as status reports and scheduled
                          maintenances.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="includeComponents"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between">
                      <div className="space-y-0.5">
                        <FormLabel>Components</FormLabel>
                        <FormDescription>
                          Import components and groups.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />
                {watchProvider !== "betterstack" ? (
                  <FormField
                    control={form.control}
                    name="includeSubscribers"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-center justify-between">
                        <div className="space-y-0.5">
                          <FormLabel>Subscribers</FormLabel>
                          <FormDescription>
                            Import email subscribers.
                          </FormDescription>
                        </div>
                        <FormControl>
                          <Switch
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                ) : null}
              </FormCardContent>
            </>
          ) : null}
          <FormCardFooter>
            <Button
              type="submit"
              disabled={
                !previewMutation.data ||
                isPending ||
                previewMutation.data.errors.length > 0
              }
            >
              {isPending ? "Importing..." : "Import"}
            </Button>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
