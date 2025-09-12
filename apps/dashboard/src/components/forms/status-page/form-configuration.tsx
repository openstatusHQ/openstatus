import { useEffect, useTransition } from "react";
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
import { Switch } from "@/components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { isTRPCClientError } from "@trpc/client";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

const schema = z.object({
  new: z.boolean(),
  configuration: z.record(z.string(), z.string().optional()),
});

type FormValues = z.infer<typeof schema>;

export function FormConfiguration({
  defaultValues,
  onSubmit,
}: {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
}) {
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      new: false,
      configuration: {},
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
    if (watchNew) {
      form.setValue("configuration.type", "absolute");
      form.setValue("configuration.value", "duration");
      form.setValue("configuration.uptime", "true");
    } else {
      form.setValue("configuration", {});
    }
  }, [watchNew, form]);

  useEffect(() => {
    if (watchConfigurationType === "manual") {
      // TODO: this is not working
      form.setValue("configuration.value", undefined);
    }
  }, [watchConfigurationType, form]);

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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)}>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Status Page Redesign (alpha)</FormCardTitle>
            <FormCardDescription>
              Use the latest version of the status page and customize it.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent>
            <FormField
              control={form.control}
              name="new"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center">
                  <FormLabel>Enable New Version</FormLabel>
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
          {watchNew && (
            <>
              <FormCardSeparator />
              <FormCardContent className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="configuration.type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bar Type</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value ?? "absolute"}
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
                        defaultValue={field.value ?? "duration"}
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
                        defaultValue={field.value ?? "true"}
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
                <Note color="info" className="col-span-full">
                  <ul className="list-inside list-disc">
                    <li>
                      <span className="font-semibold">Bar Type</span>:{" "}
                      {message.type[watchConfigurationType]}
                    </li>
                    <li>
                      <span className="font-semibold">Card Value</span>:{" "}
                      {message.value[watchConfigurationValue] ??
                        message.value.default}
                    </li>
                    <li>
                      <span className="font-semibold">Show Uptime</span>:{" "}
                      {message.uptime[watchConfigurationUptime]}
                    </li>
                  </ul>
                </Note>
              </FormCardContent>
            </>
          )}
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about{" "}
              <Link
                href="https://docs.openstatus.dev/"
                rel="noreferrer"
                target="_blank"
              >
                Status Page Configuration
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
    true: "shares the uptime and status of your endpoint.",
    false: "shares only the current status.",
  },
} as const;
