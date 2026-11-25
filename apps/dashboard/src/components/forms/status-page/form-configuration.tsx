import { zodResolver } from "@hookform/resolvers/zod";
import {
  pageCardValues,
  pageCheckCardValues,
} from "@openstatus/db/src/schema/pages/constants";
import { ArrowUpRight } from "@openstatus/icons";
import { THEMES, THEME_KEYS } from "@openstatus/theme-store";
import { Button } from "@openstatus/ui/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@openstatus/ui/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@openstatus/ui/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import { cn } from "@openstatus/ui/lib/utils";
import { isTRPCClientError } from "@trpc/client";
import NextLink from "next/link";
import { parseAsStringLiteral, useQueryStates } from "nuqs";
import { useEffect, useState, useTransition } from "react";
import { type UseFormReturn, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Link } from "@/components/common/link";
import { Note } from "@/components/common/note";
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
import { UptimeCalculation } from "@/components/status-pages/uptime-calculation";
import {
  UPTIME_MODES,
  configurationLabels,
  uptimeModeOf,
} from "@/data/uptime-calculation.client";

const schema = z.object({
  configuration: z.record(
    z.string(),
    z.string().or(z.boolean()).or(z.number()).nullish().optional(),
  ),
});

const configurationSchema = z
  .object({
    type: z.enum(["manual", "absolute"]),
    value: z.enum(pageCardValues).nullish(),
    uptime: z.boolean().or(z.literal("true").or(z.literal("false"))),
    theme: z.enum(THEME_KEYS as [string, ...string[]]),
    days: z
      .union([z.literal(30), z.literal(45)])
      .or(z.literal("30").or(z.literal("45")))
      .nullish(),
  })
  .refine(
    (data) => {
      // If type is "manual", value must be "manual"
      if (data.type === "manual") return data.value === "manual";
      return true;
    },
    {
      error: "Value must be manual when type is manual",
      path: ["value"],
    },
  );

type FormValues = z.infer<typeof schema>;

export function FormConfiguration({
  defaultValues,
  onSubmit,
  configLink,
  hasMonitorComponents = true,
}: {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  configLink: string;
  hasMonitorComponents?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      configuration: {},
    },
  });
  const watchConfigurationType = form.watch("configuration.type") as
    | "manual"
    | "absolute";
  const watchConfigurationValue = form.watch(
    "configuration.value",
  ) as (typeof pageCheckCardValues)[number];
  const watchConfigurationUptime = form.watch("configuration.uptime") as
    | "true"
    | "false";
  const mode = uptimeModeOf(watchConfigurationType, watchConfigurationValue);
  const savedMode = uptimeModeOf(
    String(defaultValues?.configuration.type),
    String(defaultValues?.configuration.value),
  );
  const savedLabel = UPTIME_MODES.find((m) => m.value === savedMode)?.label;

  useEffect(() => {
    if (watchConfigurationType === "manual") {
      form.setValue("configuration.value", "manual");
    } else {
      // runs on mount too: only replace a value that is invalid for monitor
      // checks, with the read default of a page without configuration
      const value = form.getValues("configuration.value");
      if (!pageCheckCardValues.some((v) => v === value)) {
        form.setValue("configuration.value", "requests");
      }
      form.setValue("configuration.type", "absolute");
      if (!watchConfigurationUptime) {
        form.setValue("configuration.uptime", "true");
      }
    }
  }, [watchConfigurationType, watchConfigurationUptime, form]);

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: "Saved",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return "Failed to save";
          },
        });
        await promise;
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <>
      <Form {...form}>
        <form id="redesign" onSubmit={form.handleSubmit(submitAction)}>
          <FormCard id="components-configuration">
            <FormCardHeader>
              <FormCardTitle>Components Configuration</FormCardTitle>
              <FormCardDescription>
                Configure which data should be shown for your components.
              </FormCardDescription>
            </FormCardHeader>
            <FormCardSeparator />
            <FormCardContent
              className={cn(
                "grid gap-4 sm:grid-cols-3",
                !hasMonitorComponents && "pointer-events-none opacity-50",
              )}
            >
              <FormField
                control={form.control}
                name="configuration.type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status source</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={String(field.value ?? "absolute")}
                      disabled={!hasMonitorComponents}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a source" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {(["absolute", "manual"] as const).map((type) => (
                          <SelectItem key={type} value={type}>
                            {configurationLabels.type[type]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="configuration.value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Card shows</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={String(field.value ?? "requests")}
                      disabled={
                        !hasMonitorComponents ||
                        watchConfigurationType === "manual"
                      }
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          {watchConfigurationType === "manual" ? (
                            <span className="text-muted-foreground">
                              Not available for reports only
                            </span>
                          ) : (
                            <SelectValue placeholder="Select a value" />
                          )}
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {pageCheckCardValues.map((value) => (
                          <SelectItem key={value} value={value}>
                            {configurationLabels.value[value]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              {hasMonitorComponents ? null : (
                <Note className="col-span-full">
                  Add a monitor component to your status page to configure how
                  its bars and cards display data.
                </Note>
              )}
              {hasMonitorComponents ? (
                <div className="col-span-full grid gap-2">
                  <span className="text-sm font-medium">
                    How uptime is calculated
                  </span>
                  <UptimeCalculation
                    mode={mode}
                    configured={savedMode}
                    onModeChange={(next) => {
                      const manual = next === "manual";
                      form.setValue(
                        "configuration.type",
                        manual ? "manual" : "absolute",
                        { shouldDirty: true },
                      );
                      form.setValue("configuration.value", next, {
                        shouldDirty: true,
                      });
                    }}
                  >
                    {mode !== savedMode ? (
                      <p className="text-muted-foreground">
                        Visitors keep seeing {savedLabel} until you submit.
                      </p>
                    ) : null}
                  </UptimeCalculation>
                </div>
              ) : null}
            </FormCardContent>
            <FormCardSeparator />
            <FormCardContent className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="configuration.uptime"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Show uptime percentage</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={String(field.value) ?? "true"}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full capitalize">
                          <SelectValue placeholder="Select a type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["true", "false"].map((type) => (
                          <SelectItem
                            key={type}
                            value={type}
                            className="capitalize"
                          >
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="configuration.days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>History</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={String(field.value ?? 45)}
                    >
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select a range" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {["30", "45"].map((days) => (
                          <SelectItem key={days} value={days}>
                            {days} days
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </FormCardContent>
            <FormCardFooter className="flex-wrap">
              <FormCardFooterInfo>
                Learn more about{" "}
                <Link
                  href="https://www.openstatus.dev/docs/tutorial/how-to-configure-status-page"
                  rel="noreferrer"
                  target="_blank"
                >
                  Configuration
                </Link>
                .
              </FormCardFooterInfo>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" asChild>
                  <NextLink
                    href={configLink}
                    rel="noreferrer"
                    target="_blank"
                    className="inline-flex items-center gap-1"
                  >
                    View and configure status page{" "}
                    <ArrowUpRight className="h-4 w-4" />
                  </NextLink>
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? "Submitting..." : "Submit"}
                </Button>
              </div>
            </FormCardFooter>
          </FormCard>
        </form>
      </Form>
      <FormConfigurationDialog
        defaultValues={defaultValues}
        form={form}
        onSubmit={async (e) => {
          await onSubmit(e);
          // NOTE: make sure to sync the form with the new values
          form.reset(e);
        }}
      />
    </>
  );
}

// ?type=manual&value=manual&uptime=true&theme=default&days=45

const searchParams = {
  type: parseAsStringLiteral(["manual", "absolute"]),
  value: parseAsStringLiteral(pageCardValues),
  uptime: parseAsStringLiteral(["true", "false"]),
  theme: parseAsStringLiteral(Object.keys(THEMES)),
  days: parseAsStringLiteral(["30", "45"]),
};

function FormConfigurationDialog({
  defaultValues,
  onSubmit,
}: {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  form: UseFormReturn<FormValues>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [{ type, value, uptime, theme, days }, setSearchParams] =
    useQueryStates(searchParams);

  useEffect(() => {
    if (type) setOpen(true);
  }, [type]);

  function submitAction(values: FormValues) {
    if (isPending) return;

    const data = configurationSchema.safeParse(values.configuration);
    if (!data.success) {
      toast.error(data.error.message);
      return;
    }

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: "Saved",
          error: (error) => {
            if (isTRPCClientError(error)) {
              return error.message;
            }
            return "Failed to save";
          },
        });
        await promise;
        await setSearchParams({
          type: null,
          value: null,
          uptime: null,
          theme: null,
          days: null,
        });
        setOpen(false);
      } catch (error) {
        console.error(error);
      } finally {
        if (typeof window !== "undefined") {
          window.location.reload();
        }
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Status Page Configuration</DialogTitle>
          <DialogDescription>
            Do you want to update the status page based on the configured
            settings? You can always change the settings later.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <pre className="bg-muted/50 font-commit-mono rounded-md border px-3 py-2 text-sm">
            {JSON.stringify({ type, value, uptime, theme, days }, null, 2)}
          </pre>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="outline">Cancel</Button>
          </DialogClose>
          <Button
            type="button"
            onClick={() =>
              submitAction({
                ...defaultValues,
                configuration: {
                  type: type ?? undefined,
                  value: value ?? undefined,
                  uptime: uptime ?? undefined,
                  theme: theme ?? undefined,
                  // fall back to the page's stored value when the URL omits
                  // `days` (e.g. links generated before it was added).
                  days: days ?? defaultValues?.configuration?.days ?? undefined,
                },
              })
            }
            disabled={isPending}
          >
            {isPending ? "Saving..." : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
