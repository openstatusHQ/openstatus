"use client";

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
import { Button } from "@/components/ui/button";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Form } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { zodResolver } from "@hookform/resolvers/zod";
import { isTRPCClientError } from "@trpc/client";
import { Globe, Network, Plus, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  textBodyAssertion,
  statusAssertion,
  headerAssertion,
  numberCompareDictionary,
  stringCompareDictionary,
  jsonBodyAssertion,
} from "@openstatus/assertions";
import { monitorMethods } from "@openstatus/db/src/schema";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";

const TYPES = ["http", "tcp"] as const;
const ASSERTION_TYPES = ["status", "header", "textBody"] as const;

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(TYPES),
  method: z.enum(monitorMethods),
  url: z.string().min(1, "URL is required"),
  headers: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    })
  ),
  active: z.boolean().optional().default(true),
  assertions: z.array(
    z.discriminatedUnion("type", [
      statusAssertion,
      headerAssertion,
      textBodyAssertion,
      jsonBodyAssertion,
    ])
  ),
  body: z.string().optional(),
  skipCheck: z.boolean().optional().default(false),
  saveCheck: z.boolean().optional().default(false),
});

type FormValues = z.infer<typeof schema>;

export function FormGeneral({
  defaultValues,
  disabled,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit: (values: FormValues) => Promise<void>;
  disabled?: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      active: true,
      name: "",
      type: undefined,
      method: "GET",
      url: "",
      headers: [],
      body: "",
      assertions: [],
      skipCheck: false,
      saveCheck: false,
    },
  });
  const [isPending, startTransition] = useTransition();
  const watchType = form.watch("type");
  const watchMethod = form.watch("method");

  useEffect(() => {
    // NOTE: reset form when type changes
    if (watchType && !defaultValues) {
      form.setValue("assertions", []);
      form.setValue("body", "");
      form.setValue("headers", []);
      form.setValue("method", "GET");
      form.setValue("url", "");
    }
  }, [watchType, defaultValues, form]);

  function submitAction(values: FormValues) {
    console.log("submitAction", values);
    if (isPending || disabled) return;

    // Validate assertions based on type
    for (let i = 0; i < values.assertions.length; i++) {
      const assertion = values.assertions[i];

      if (assertion.type === "status") {
        if (typeof assertion.target !== "number" || assertion.target <= 0) {
          form.setError(`assertions.${i}.target`, {
            message: "Status target must be a positive number",
          });
          return;
        }
      } else if (assertion.type === "header") {
        if (!assertion.key || assertion.key.trim() === "") {
          form.setError(`assertions.${i}.key`, {
            message: "Header key is required",
          });
          return;
        }
        if (!assertion.target || assertion.target.trim() === "") {
          form.setError(`assertions.${i}.target`, {
            message: "Header target is required",
          });
          return;
        }
      } else if (assertion.type === "textBody") {
        if (!assertion.target || assertion.target.trim() === "") {
          form.setError(`assertions.${i}.target`, {
            message: "Body target is required",
          });
          return;
        }
      }
    }

    // TODO: validate url if HTTP
    // if (values.type === "http" && !values.url.startsWith("http")) {
    //   form.setError("url", { message: "Please enter a valid URL" });
    //   return;
    // }

    startTransition(async () => {
      try {
        const promise = onSubmit(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: "Saved",
          error: (error) => {
            if (isTRPCClientError(error)) {
              setError(error.message);
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

  console.log(form.getValues("skipCheck"));

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(submitAction)} {...props}>
        <FormCard>
          <FormCardHeader>
            <FormCardTitle>Monitor Configuration</FormCardTitle>
            <FormCardDescription>
              Configure your monitor settings and endpoints.
            </FormCardDescription>
          </FormCardHeader>
          <FormCardContent className="grid sm:grid-cols-3 gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem className="sm:col-span-2">
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="OpenStatus API" {...field} />
                  </FormControl>
                  <FormMessage />
                  <FormDescription>
                    Displayed on the status page.
                  </FormDescription>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center">
                  <FormLabel>Active</FormLabel>
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
          <FormCardSeparator />
          <FormCardContent>
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Monitoring Type</FormLabel>
                  <FormControl>
                    <RadioGroup
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                      className="grid grid-cols-2 gap-4 sm:grid-cols-4"
                      disabled={!!defaultValues?.type}
                    >
                      <FormItem
                        className={cn(
                          "relative flex cursor-pointer flex-row items-center gap-3 rounded-md border border-input px-2 py-3 text-center shadow-xs outline-none transition-[color,box-shadow] has-aria-[invalid=true]:border-destructive has-data-[state=checked]:border-primary/50 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                          // FIXME: ugly af
                          defaultValues &&
                            defaultValues.type !== "http" &&
                            "opacity-50 pointer-events-none"
                        )}
                      >
                        <FormControl>
                          <RadioGroupItem
                            value="http"
                            className="sr-only"
                            disabled={!!defaultValues?.type}
                          />
                        </FormControl>
                        <Globe
                          className="shrink-0 text-muted-foreground"
                          size={16}
                          aria-hidden="true"
                        />
                        <FormLabel className="cursor-pointer font-medium text-foreground text-xs leading-none after:absolute after:inset-0">
                          HTTP
                        </FormLabel>
                      </FormItem>
                      <FormItem
                        className={cn(
                          "relative flex cursor-pointer flex-row items-center gap-3 rounded-md border border-input px-2 py-3 text-center shadow-xs outline-none transition-[color,box-shadow] has-aria-[invalid=true]:border-destructive has-data-[state=checked]:border-primary/50 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                          defaultValues &&
                            defaultValues.type !== "tcp" &&
                            "opacity-50 pointer-events-none"
                        )}
                      >
                        <FormControl>
                          <RadioGroupItem
                            value="tcp"
                            className="sr-only"
                            disabled={!!defaultValues?.type}
                          />
                        </FormControl>
                        <Network
                          className="shrink-0 text-muted-foreground"
                          size={16}
                          aria-hidden="true"
                        />
                        <FormLabel className="cursor-pointer font-medium text-foreground text-xs leading-none after:absolute after:inset-0">
                          TCP
                        </FormLabel>
                      </FormItem>
                      <div className="col-span-2 self-end text-muted-foreground text-xs sm:place-self-end">
                        Missing a type? <Link href="/contact">Contact us</Link>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </FormCardContent>
          {watchType ? <FormCardSeparator /> : null}
          {watchType === "http" && (
            <>
              <FormCardContent className="grid grid-cols-4 gap-4">
                <div className="col-span-1">
                  <FormField
                    control={form.control}
                    name="method"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Method</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder="Select a method" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {monitorMethods.map((method) => (
                              <SelectItem key={method} value={method}>
                                {method}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="col-span-3">
                  <FormField
                    control={form.control}
                    name="url"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>URL</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="https://openstatus.dev"
                            type="url"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="headers"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel>Request Headers</FormLabel>
                      {field.value.map((header, index) => (
                        <div key={index} className="grid gap-2 sm:grid-cols-5">
                          <Input
                            placeholder="Key"
                            className="col-span-2"
                            value={header.key}
                            onChange={(e) => {
                              const newHeaders = [...field.value];
                              newHeaders[index] = {
                                ...newHeaders[index],
                                key: e.target.value,
                              };
                              field.onChange(newHeaders);
                            }}
                          />
                          <Input
                            placeholder="Value"
                            className="col-span-2"
                            value={header.value}
                            onChange={(e) => {
                              const newHeaders = [...field.value];
                              newHeaders[index] = {
                                ...newHeaders[index],
                                value: e.target.value,
                              };
                              field.onChange(newHeaders);
                            }}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              const newHeaders = field.value.filter(
                                (_, i) => i !== index
                              );
                              field.onChange(newHeaders);
                            }}
                          >
                            <X />
                          </Button>
                        </div>
                      ))}
                      <div>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            field.onChange([
                              ...field.value,
                              { key: "", value: "" },
                            ]);
                          }}
                        >
                          <Plus />
                          Add Header
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {["POST", "PUT", "PATCH", "DELETE"].includes(watchMethod) && (
                  <FormField
                    control={form.control}
                    name="body"
                    render={({ field }) => (
                      <FormItem className="col-span-full">
                        <FormLabel>Body</FormLabel>
                        <FormControl>
                          <Textarea {...field} />
                        </FormControl>
                        <FormDescription>Write your payload</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </FormCardContent>
              <FormCardSeparator />
              <FormCardContent>
                <FormField
                  control={form.control}
                  name="assertions"
                  render={({ field }) => (
                    <FormItem className="col-span-full">
                      <FormLabel>Assertions</FormLabel>
                      <FormDescription>
                        Validate the response to ensure your service is working
                        as expected. <br />
                        Add body, header, or status assertions.
                      </FormDescription>
                      {field.value.map((assertion, index) => (
                        <div key={index} className="grid gap-2 sm:grid-cols-6">
                          <FormField
                            control={form.control}
                            name={`assertions.${index}.type`}
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  disabled={true}
                                >
                                  <SelectTrigger
                                    aria-invalid={
                                      !!form.formState.errors.assertions?.[
                                        index
                                      ]?.type
                                    }
                                    className="w-full"
                                  >
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ASSERTION_TYPES.map((type) => (
                                      <SelectItem key={type} value={type}>
                                        {type}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`assertions.${index}.compare`}
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select compare" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {assertion.type === "status"
                                      ? Object.entries(
                                          numberCompareDictionary
                                        ).map(([key, value]) => (
                                          <SelectItem key={key} value={key}>
                                            {value}
                                          </SelectItem>
                                        ))
                                      : Object.entries(
                                          stringCompareDictionary
                                        ).map(([key, value]) => (
                                          <SelectItem key={key} value={key}>
                                            {value}
                                          </SelectItem>
                                        ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          {assertion.type === "header" && (
                            <FormField
                              control={form.control}
                              name={`assertions.${index}.key`}
                              render={({ field }) => (
                                <FormItem>
                                  <Input
                                    placeholder="Header key"
                                    className="w-full"
                                    {...field}
                                  />
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          )}
                          <FormField
                            control={form.control}
                            name={`assertions.${index}.target`}
                            render={({ field }) => (
                              <FormItem>
                                <Input
                                  placeholder="Target value"
                                  className="w-full"
                                  type={
                                    assertion.type === "status"
                                      ? "number"
                                      : "text"
                                  }
                                  {...field}
                                  value={field.value?.toString() || ""}
                                  onChange={(e) => {
                                    const value =
                                      assertion.type === "status"
                                        ? parseInt(e.target.value) || 0
                                        : e.target.value;
                                    field.onChange(value);
                                  }}
                                />
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            type="button"
                            onClick={() => {
                              const newAssertions = field.value.filter(
                                (_, i) => i !== index
                              );
                              field.onChange(newAssertions);
                            }}
                          >
                            <X />
                          </Button>
                        </div>
                      ))}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            field.onChange([
                              ...field.value,
                              {
                                type: "status",
                                version: "v1",
                                compare: "eq",
                                target: 200,
                              },
                            ]);
                          }}
                        >
                          <Plus />
                          Add Status Assertion
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            field.onChange([
                              ...field.value,
                              {
                                type: "header",
                                version: "v1",
                                compare: "eq",
                                key: "",
                                target: "",
                              },
                            ]);
                          }}
                        >
                          <Plus />
                          Add Header Assertion
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            field.onChange([
                              ...field.value,
                              {
                                type: "textBody",
                                version: "v1",
                                compare: "eq",
                                target: "",
                              },
                            ]);
                          }}
                        >
                          <Plus />
                          Add Body Assertion
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormCardContent>
            </>
          )}
          {watchType === "tcp" && (
            <FormCardContent className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem className="sm:col-span-2">
                    <FormLabel>Host:Port</FormLabel>
                    <FormControl>
                      <Input placeholder="127.0.0.0.1:8080" {...field} />
                    </FormControl>
                    <FormMessage />
                    <FormDescription>
                      The input supports both IPv4 addresses and IPv6 addresses.
                    </FormDescription>
                  </FormItem>
                )}
              />
              <div className="col-span-full text-muted-foreground text-sm">
                Examples:
                <ul className="list-inside list-disc">
                  <li>
                    Domain:{" "}
                    <span className="font-mono text-foreground">
                      openstatus.dev:443
                    </span>
                  </li>
                  <li>
                    IPv4:{" "}
                    <span className="font-mono text-foreground">
                      192.168.1.1:443
                    </span>
                  </li>
                  <li>
                    IPv6:{" "}
                    <span className="font-mono text-foreground">
                      [2001:db8:85a3:8d3:1319:8a2e:370:7348]:443
                    </span>
                  </li>
                </ul>
              </div>
            </FormCardContent>
          )}
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about{" "}
              <Link
                href="https://docs.openstatus.dev/monitoring/create-monitor/"
                rel="noreferrer"
                target="_blank"
              >
                Monitor Type
              </Link>{" "}
              and{" "}
              <Link
                href="https://docs.openstatus.dev/monitoring/create-monitor/"
                rel="noreferrer"
                target="_blank"
              >
                Assertions
              </Link>
              .
            </FormCardFooterInfo>
            <Button type="submit" disabled={isPending || disabled}>
              {isPending ? "Submitting..." : "Submit"}
            </Button>
          </FormCardFooter>
        </FormCard>
        <AlertDialog open={!!error} onOpenChange={() => setError(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Still save?</AlertDialogTitle>
              <AlertDialogDescription>
                It seems like the endpoint is not reachable or the assertions
                failed. Do you want to save the monitor anyway?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="p-2 border border-destructive/20 rounded-md bg-destructive/10">
              <p className="font-mono text-sm text-destructive whitespace-pre-wrap">
                {error}
              </p>
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel type="button">Cancel</AlertDialogCancel>
              <AlertDialogAction
                type="button"
                onClick={async (e) => {
                  e.preventDefault();
                  form.setValue("skipCheck", true);
                  form.handleSubmit(submitAction)();
                  form.setValue("skipCheck", false);
                  setError(null);
                }}
                disabled={isPending}
              >
                Save
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </form>
    </Form>
  );
}
