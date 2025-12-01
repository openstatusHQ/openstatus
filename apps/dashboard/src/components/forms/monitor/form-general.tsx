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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  dnsRecords,
  headerAssertion,
  jsonBodyAssertion,
  numberCompareDictionary,
  recordAssertion,
  recordCompareDictionary,
  statusAssertion,
  stringCompareDictionary,
  textBodyAssertion,
} from "@openstatus/assertions";
import { monitorMethods } from "@openstatus/db/src/schema";
import { isTRPCClientError } from "@trpc/client";
import { Globe, Network, Plus, Server, X } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

const TYPES = ["http", "tcp", "dns"] as const;
const HTTP_ASSERTION_TYPES = ["status", "header", "textBody"] as const;
const DNS_ASSERTION_TYPES = dnsRecords;

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(TYPES),
  method: z.enum(monitorMethods),
  url: z.string().min(1, "URL is required"),
  headers: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    }),
  ),
  active: z.boolean().optional().default(true),
  assertions: z.array(
    z.discriminatedUnion("type", [
      statusAssertion,
      headerAssertion,
      textBodyAssertion,
      jsonBodyAssertion,
      recordAssertion,
    ]),
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
      } else if (assertion.type === "dnsRecord") {
        if (!assertion.key || assertion.key.trim() === "") {
          form.setError(`assertions.${i}.key`, {
            message: "DNS record key is required",
          });
          return;
        }
        if (!assertion.target || assertion.target.trim() === "") {
          form.setError(`assertions.${i}.target`, {
            message: "DNS record target is required",
          });
          return;
        }
      }
    }

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
          <FormCardContent className="grid gap-4 sm:grid-cols-3">
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
                      {[
                        { value: "http", icon: Globe, label: "HTTP" },
                        { value: "tcp", icon: Network, label: "TCP" },
                        { value: "dns", icon: Server, label: "DNS" },
                      ].map((type) => {
                        return (
                          <FormItem
                            key={type.value}
                            className={cn(
                              "relative flex cursor-pointer flex-row items-center gap-3 rounded-md border border-input px-2 py-3 text-center shadow-xs outline-none transition-[color,box-shadow] has-aria-[invalid=true]:border-destructive has-data-[state=checked]:border-primary/50 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50",
                              defaultValues &&
                                defaultValues.type !== type.value &&
                                "pointer-events-none opacity-50",
                            )}
                          >
                            <FormControl>
                              <RadioGroupItem
                                value={type.value}
                                className="sr-only"
                                disabled={!!defaultValues?.type}
                              />
                            </FormControl>
                            <type.icon
                              className="shrink-0 text-muted-foreground"
                              size={16}
                              aria-hidden="true"
                            />
                            <FormLabel className="cursor-pointer font-medium text-foreground text-xs leading-none after:absolute after:inset-0">
                              {type.label}
                            </FormLabel>
                          </FormItem>
                        );
                      })}
                      <div
                        className={cn(
                          "col-span-1 self-end text-muted-foreground text-xs sm:place-self-end",
                        )}
                      >
                        Missing a type?{" "}
                        <a href="mailto:ping@openstatus.dev">Contact us</a>
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
                                (_, i) => i !== index,
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
                                    {HTTP_ASSERTION_TYPES.map((type) => (
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
                                  <SelectTrigger className="w-full min-w-16">
                                    <span className="truncate">
                                      <SelectValue placeholder="Select compare" />
                                    </span>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {assertion.type === "status"
                                      ? Object.entries(
                                          numberCompareDictionary,
                                        ).map(([key, value]) => (
                                          <SelectItem key={key} value={key}>
                                            {value}
                                          </SelectItem>
                                        ))
                                      : Object.entries(
                                          stringCompareDictionary,
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
                                        ? Number.parseInt(e.target.value) || 0
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
                                (_, i) => i !== index,
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
                            const currentAssertions =
                              form.getValues("assertions");
                            field.onChange([
                              ...currentAssertions,
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
                            const currentAssertions =
                              form.getValues("assertions");
                            field.onChange([
                              ...currentAssertions,
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
                            const currentAssertions =
                              form.getValues("assertions");
                            field.onChange([
                              ...currentAssertions,
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
          {watchType === "dns" && (
            <>
              <FormCardContent className="grid gap-4 sm:grid-cols-3">
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem className="sm:col-span-2">
                      <FormLabel>URI</FormLabel>
                      <FormControl>
                        <Input placeholder="openstatus.dev" {...field} />
                      </FormControl>
                      <FormMessage />
                      <FormDescription>
                        The input supports both domain names and URIs.
                      </FormDescription>
                    </FormItem>
                  )}
                />
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
                        Add DNS record assertions.
                      </FormDescription>
                      {field.value.map((assertion, index) => (
                        <div key={index} className="grid gap-2 sm:grid-cols-6">
                          <FormField
                            control={form.control}
                            name={`assertions.${index}.type`}
                            defaultValue={"dnsRecord"}
                            render={({ field }) => (
                              <FormItem className="hidden">
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  disabled
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select type" />
                                  </SelectTrigger>
                                </Select>
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={form.control}
                            name={`assertions.${index}.key`}
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
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
                                    {DNS_ASSERTION_TYPES.map((type) => (
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
                                  <SelectTrigger className="w-full min-w-16">
                                    <span className="truncate">
                                      <SelectValue placeholder="Select compare" />
                                    </span>
                                  </SelectTrigger>
                                  <SelectContent>
                                    {Object.entries(
                                      recordCompareDictionary,
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
                                        ? Number.parseInt(e.target.value) || 0
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
                                (_, i) => i !== index,
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
                            const currentAssertions =
                              form.getValues("assertions");
                            field.onChange([
                              ...currentAssertions,
                              {
                                type: "dnsRecord",
                                version: "v1",
                                compare: "eq",
                                key: "A",
                                target: "",
                              },
                            ]);
                          }}
                        >
                          <Plus />
                          Add DNS Record Assertion
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormCardContent>
            </>
          )}
          <FormCardFooter>
            <FormCardFooterInfo>
              Learn more about{" "}
              <Link
                href="https://docs.openstatus.dev/tutorial/how-to-create-monitor/"
                rel="noreferrer"
                target="_blank"
              >
                Monitor Type
              </Link>{" "}
              and{" "}
              <Link
                href="https://docs.openstatus.dev/tutorial/how-to-create-monitor/"
                rel="noreferrer"
                target="_blank"
              >
                Assertions
              </Link>
              . We test your endpoint before saving the monitor.
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
            <div className="rounded-md border border-destructive/20 bg-destructive/10 p-2">
              <p className="whitespace-pre-wrap font-mono text-destructive text-sm">
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
