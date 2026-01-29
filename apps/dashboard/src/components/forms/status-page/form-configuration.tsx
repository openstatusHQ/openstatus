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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { zodResolver } from "@hookform/resolvers/zod";
import { THEMES, THEME_KEYS } from "@openstatus/theme-store";
import { isTRPCClientError } from "@trpc/client";
import { ArrowUpRight } from "lucide-react";
import { parseAsStringLiteral, useQueryStates } from "nuqs";
import { type UseFormReturn, useForm } from "react-hook-form";
import { toast } from "sonner";

const schema = z.object({
  configuration: z.record(
    z.string(),
    z.string().or(z.boolean().nullish()).optional(),
  ),
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
      error: "Value must be manual when type is manual",
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
      configuration: {},
    },
  });
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
          <FormCard>
            <FormCardHeader>
              <FormCardTitle>Components Configuration</FormCardTitle>
              <FormCardDescription>
                Configure which data should be shown for your components.
              </FormCardDescription>
            </FormCardHeader>
            <FormCardSeparator />
            <FormCardContent className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="configuration.type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Bar Type*</FormLabel>
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
                    <FormLabel>Card Value*</FormLabel>
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
              <p className="col-span-full text-foreground/70 text-sm">
                *Configuration settings only apply to monitor components.
              </p>
              <Note className="col-span-full">
                <ul className="list-inside list-disc">
                  <li>
                    <span>Bar Type </span>
                    <span className="font-medium">
                      {watchConfigurationType}
                    </span>
                    : <span>{message.type[watchConfigurationType]}</span>
                  </li>
                  <li>
                    <span>Card Value </span>
                    <span className="font-medium">
                      {watchConfigurationValue}
                    </span>
                    :{" "}
                    <span>
                      {message.value[watchConfigurationValue] ??
                        message.value.default}
                    </span>
                  </li>
                  <li>
                    <span>Show Uptime </span>
                    <span className="font-medium capitalize">
                      {String(watchConfigurationUptime)}
                    </span>
                    : <span>{message.uptime[watchConfigurationUptime]}</span>
                  </li>
                </ul>
              </Note>
            </FormCardContent>
            <FormCardFooter>
              <FormCardFooterInfo>
                Learn more about{" "}
                <Link
                  href="https://docs.openstatus.dev/tutorial/how-to-configure-status-page"
                  rel="noreferrer"
                  target="_blank"
                >
                  Configuration
                </Link>
                .
              </FormCardFooterInfo>
              <div className="flex items-center gap-2">
                <Button type="button" variant="ghost" asChild>
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
  form: UseFormReturn<FormValues>;
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
        await setSearchParams({
          type: null,
          value: null,
          uptime: null,
          theme: null,
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
          <pre className="rounded-md border bg-muted/50 px-3 py-2 font-commit-mono text-sm">
            {JSON.stringify({ type, value, uptime, theme }, null, 2)}
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
