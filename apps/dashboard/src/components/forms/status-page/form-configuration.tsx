import { useEffect, useState, useTransition } from "react";
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
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { THEMES, THEME_KEYS } from "@openstatus/theme-store";
import { isTRPCClientError } from "@trpc/client";
import { ArrowUpRight, Info } from "lucide-react";
import { parseAsStringLiteral, useQueryStates } from "nuqs";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const schema = z.object({
  new: z.boolean(),
  configuration: z.record(z.string(), z.string().or(z.boolean()).optional()),
  homepageUrl: z.string().optional(),
  contactUrl: z.string().optional(),
});

const configurationSchema = z
  .object({
    type: z.enum(["manual", "absolute"]),
    value: z.enum(["duration", "requests", "manual"]).nullish(),
    uptime: z.boolean().or(z.literal("true").or(z.literal("false"))),
    theme: z.enum(THEME_KEYS as [string, ...string[]]),
  })
  .refine(
    (data) => {
      // If type is "manual", value must be "manual"
      if (data.type === "manual") return data.value === "manual";
      return true;
    },
    {
      message: "Value must be manual when type is manual",
      path: ["value"],
    },
  );

type FormValues = z.infer<typeof schema>;

export function FormConfiguration({
  defaultValues,
  onSubmit,
  configLink,
}: {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  configLink: string;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      new: false,
      configuration: {},
      homepageUrl: "",
      contactUrl: "",
    },
  });
  const watchNew = form.watch("new");
  const watchConfigurationType = form.watch("configuration.type") as
    | "manual"
    | "absolute";
  const watchConfigurationValue = form.watch("configuration.value") as
    | "duration"
    | "requests";
  const watchConfigurationUptime = form.watch("configuration.uptime") as
    | "true"
    | "false";

  useEffect(() => {
    if (watchConfigurationType === "manual") {
      form.setValue("configuration.value", "manual");
    } else {
      form.setValue("configuration.value", "duration");
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
          <FormCard variant="info">
            <FormCardHeader>
              <FormCardTitle>Status Page Redesign (beta)</FormCardTitle>
              <FormCardDescription>
                Use the latest version of the status page and customize it.
              </FormCardDescription>
            </FormCardHeader>
            <FormCardContent className="grid gap-4 md:grid-cols-3">
              <FormField
                control={form.control}
                name="new"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between">
                    <div className="space-y-0.5">
                      <FormLabel>Enable New Version</FormLabel>
                      <FormDescription>
                        More controls, better UI.
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
              <div className="flex items-center md:col-span-2 md:justify-end">
                <Button size="sm" asChild>
                  <Link
                    href={configLink}
                    rel="noreferrer"
                    target="_blank"
                    className="inline-flex items-center gap-1"
                  >
                    View and configure status page{" "}
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </FormCardContent>
            {watchNew && (
              <>
                <FormCardSeparator />
                <FormCardContent className="grid gap-4 sm:grid-cols-3">
                  <FormCardHeader className="col-span-full px-0 pt-0 pb-0">
                    <FormCardTitle>Tracker Configuration</FormCardTitle>
                    <FormCardDescription>
                      Configure which data should be shown in the monitor
                      tracker.
                    </FormCardDescription>
                  </FormCardHeader>
                  <FormField
                    control={form.control}
                    name="configuration.type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Bar Type</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={String(field.value) ?? "absolute"}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full capitalize">
                              <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {["absolute", "manual"].map((type) => (
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
                    name="configuration.value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Card Value</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={String(field.value) ?? "duration"}
                          disabled={watchConfigurationType === "manual"}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full capitalize">
                              <SelectValue placeholder="Select a type" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {["duration", "requests"].map((type) => (
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
                    name="configuration.uptime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Show Uptime</FormLabel>
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
                  <Note className="col-span-full">
                    <ul className="list-inside list-disc">
                      <li>
                        <span className="font-medium">
                          Bar Type{" "}
                          <span className="font-semibold">
                            {watchConfigurationType}
                          </span>
                        </span>
                        : {message.type[watchConfigurationType]}
                      </li>
                      <li>
                        <span className="font-medium">
                          Card Value{" "}
                          <span className="font-semibold">
                            {watchConfigurationValue}
                          </span>
                        </span>
                        :{" "}
                        {message.value[watchConfigurationValue] ??
                          message.value.default}
                      </li>
                      <li>
                        <span className="font-medium">
                          Show Uptime{" "}
                          <span className="font-semibold">
                            {watchConfigurationUptime}
                          </span>
                        </span>
                        : {message.uptime[watchConfigurationUptime]}
                      </li>
                    </ul>
                  </Note>
                </FormCardContent>
                <FormCardSeparator />
                <FormCardContent className="grid gap-4 sm:grid-cols-3">
                  <FormCardHeader className="col-span-full px-0 pt-0 pb-0">
                    <FormCardTitle>Theme Explorer</FormCardTitle>
                    <FormCardDescription>
                      Configure the theme for the status page - or contribute
                      your own. Learn more about it at{" "}
                      <Link
                        href="https://themes.openstatus.dev"
                        rel="noreferrer"
                        target="_blank"
                      >
                        themes.openstatus.dev
                      </Link>
                      .
                    </FormCardDescription>
                  </FormCardHeader>
                  <FormField
                    control={form.control}
                    name="configuration.theme"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Theme</FormLabel>
                        <FormControl>
                          <Select
                            onValueChange={field.onChange}
                            defaultValue={String(field.value) ?? "default"}
                          >
                            <FormControl>
                              <SelectTrigger className="w-full capitalize">
                                <SelectValue placeholder="Select a theme" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.values(THEMES).map((theme) => (
                                <SelectItem
                                  key={theme.id}
                                  value={theme.id}
                                  className="capitalize"
                                >
                                  {theme.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </FormCardContent>
                <FormCardSeparator />
                <FormCardContent className="grid gap-4">
                  <FormCardHeader className="col-span-full px-0 pt-0 pb-0">
                    <FormCardTitle>Links</FormCardTitle>
                    <FormCardDescription>
                      Configure the links for the status page.
                    </FormCardDescription>
                  </FormCardHeader>
                  <FormField
                    control={form.control}
                    name="homepageUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Homepage URL</FormLabel>
                        <FormControl>
                          <Input placeholder="https://acme.com" {...field} />
                        </FormControl>
                        <FormMessage />
                        <FormDescription>
                          What URL should the logo link to? Leave empty to hide.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="contactUrl"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Contact URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://acme.com/contact"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                        <FormDescription>
                          Enter the URL for your contact page. Or start with{" "}
                          <code className="rounded-md bg-muted px-1 py-0.5">
                            mailto:
                          </code>{" "}
                          to open the email client. Leave empty to hide.
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </FormCardContent>
              </>
            )}
            <FormCardFooter variant="info">
              <FormCardFooterInfo>
                Learn more about{" "}
                <Link
                  href="https://docs.openstatus.dev/tutorial/how-to-configure-status-page"
                  rel="noreferrer"
                  target="_blank"
                >
                  Status Page Redesign (beta)
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
      <FormConfigurationDialog
        defaultValues={defaultValues}
        onSubmit={async (e) => {
          await onSubmit(e);
          // NOTE: make sure to sync the form with the new values
          form.reset(e);
        }}
      />
    </>
  );
}

// TODO:
const message = {
  type: {
    manual:
      "only shares the duration of reports and maintenaces you are setting up - nothing else.",
    absolute:
      "shares the status of your endpoint for the duration of the different statuses.",
  },
  value: {
    duration: "shares the duration of the different statuses.",
    requests:
      "shares the number of requests received (success, degraded, error).",
    default: "shares only the worse status of the day",
  },
  uptime: {
    true: "shares the uptime percentage and current status of your endpoint.",
    false: "shares only the current status.",
  },
} as const;

// ?type=manual&value=manual&uptime=true&theme=default

const searchParams = {
  type: parseAsStringLiteral(["manual", "absolute"]),
  value: parseAsStringLiteral(["duration", "requests", "manual"]),
  uptime: parseAsStringLiteral(["true", "false"]),
  theme: parseAsStringLiteral(Object.keys(THEMES)),
};

function FormConfigurationDialog({
  defaultValues,
  onSubmit,
}: {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [{ type, value, uptime, theme }, setSearchParams] =
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
        setSearchParams({
          type: null,
          value: null,
          uptime: null,
          theme: null,
        });
        setOpen(false);
      } catch (error) {
        console.error(error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Status Page Redesign (beta)</DialogTitle>
          <DialogDescription>
            Do you want to update the status page based on the configured
            settings?
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <pre className="rounded-md border bg-muted/50 px-3 py-2 font-commit-mono text-sm">
            {JSON.stringify({ type, value, uptime, theme }, null, 2)}
          </pre>
          {!defaultValues || !defaultValues.new ? (
            <Note color="info" className="text-sm">
              <Info />
              <p>You will activate the new version of the status page.</p>
            </Note>
          ) : null}
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
                new: true,
                configuration: {
                  type: type ?? undefined,
                  value: value ?? undefined,
                  uptime: uptime ?? undefined,
                  theme: theme ?? undefined,
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
