"use client";

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
import { StatuspageIcon } from "@openstatus/icons";
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
import { useQuery } from "@tanstack/react-query";
import { isTRPCClientError } from "@trpc/client";
import { AlertTriangle } from "lucide-react";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const schema = z.object({
  provider: z.enum(["statuspage"]),
  apiKey: z.string().min(1, "API key is required"),
  statuspagePageId: z.string().optional(),
  includeIncidents: z.boolean(),
  includeSubscribers: z.boolean(),
  includeComponents: z.boolean(),
});

export type ImportFormValues = z.input<typeof schema>;

function getPhaseCount(preview: ImportSummary, phase: string): number {
  return preview.phases.find((p) => p.phase === phase)?.resources.length ?? 0;
}

const PHASE_LABELS: Record<string, string> = {
  componentGroups: "Component Groups",
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
      includeIncidents: true,
      includeSubscribers: false,
      includeComponents: true,
    },
  });
  const [isPending, startTransition] = useTransition();
  const trpc = useTRPC();
  const watchProvider = form.watch("provider");
  const watchApiKey = form.watch("apiKey");
  const watchStatuspagePageId = form.watch("statuspagePageId");

  const previewQuery = useQuery(
    trpc.importRouter.preview.queryOptions(
      {
        provider: "statuspage",
        apiKey: watchApiKey,
        statuspagePageId: watchStatuspagePageId || undefined,
        pageId,
      },
      {
        enabled: false,
        retry: false,
      },
    ),
  );

  async function runPreview() {
    const apiKey = form.getValues("apiKey");
    if (!apiKey) {
      form.setError("apiKey", { message: "API key is required" });
      return;
    }
    const { error } = await previewQuery.refetch();
    if (error) {
      if (isTRPCClientError(error)) {
        toast.error(error.message);
      } else {
        toast.error("Failed to preview import");
      }
    }
  }

  function submitAction(values: ImportFormValues) {
    if (isPending || !previewQuery.data) return;

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
                          Statuspage.io
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
                          placeholder="OAuth API key"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                      <FormDescription>
                        Your Statuspage API key. Found in your Statuspage
                        account under Manage Account &gt; API.
                      </FormDescription>
                    </FormItem>
                  )}
                />
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
                        Import a specific page. Leave empty to import accross
                        pages.
                      </FormDescription>
                    </FormItem>
                  )}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={runPreview}
                  disabled={previewQuery.isFetching}
                >
                  {previewQuery.isFetching
                    ? "Loading preview..."
                    : "Preview Import"}
                </Button>
              </FormCardContent>
            </>
          ) : null}
          {previewQuery.data ? (
            <>
              <FormCardSeparator />
              <FormCardContent className="grid gap-4">
                <div>
                  <FormLabel>Preview</FormLabel>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {Object.entries(PHASE_LABELS).map(([key, label]) => {
                      const count = getPhaseCount(previewQuery.data, key);
                      if (count === 0) return null;
                      return (
                        <Badge key={key} variant="secondary">
                          {label}: {count}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
                {previewQuery.data.errors.length > 0 ? (
                  <Note color="error" size="sm">
                    <AlertTriangle />
                    <p className="text-sm">
                      {previewQuery.data.errors.join(" ")}
                    </p>
                  </Note>
                ) : null}
                <FormField
                  control={form.control}
                  name="includeIncidents"
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
              </FormCardContent>
            </>
          ) : null}
          <FormCardFooter>
            <Button type="submit" disabled={!previewQuery.data || isPending}>
              {isPending ? "Importing..." : "Import"}
            </Button>
          </FormCardFooter>
        </FormCard>
      </form>
    </Form>
  );
}
