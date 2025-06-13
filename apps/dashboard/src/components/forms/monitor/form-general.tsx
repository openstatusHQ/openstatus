"use client";

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Globe, Network, Plus, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTransition } from "react";
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
import { DevTool } from "@hookform/devtools";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Link } from "@/components/common/link";

const TYPES = ["HTTP", "TCP"] as const;
const METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH"] as const;
const ASSERTION_TYPES = ["status", "header", "body"] as const;
const ASSERTION_EQ = ["eq", "neq", "gt", "gte", "lt", "lte"] as const;

const schema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.enum(TYPES),
  method: z.enum(METHODS),
  url: z.string(),
  headers: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    })
  ),
  body: z.string().optional(),
  assertions: z.array(
    z.object({
      type: z.enum(ASSERTION_TYPES),
      eq: z.enum(ASSERTION_EQ),
      value: z.string().min(1),
    })
  ),
});

type FormValues = z.infer<typeof schema>;

export function FormGeneral({
  defaultValues,
  onSubmit,
  ...props
}: Omit<React.ComponentProps<"form">, "onSubmit"> & {
  defaultValues?: FormValues;
  onSubmit?: (values: FormValues) => Promise<void> | void;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaultValues ?? {
      name: "",
      type: undefined,
      method: "GET",
      url: "",
      headers: [],
      assertions: [],
      body: "",
    },
  });
  const [isPending, startTransition] = useTransition();
  const watchType = form.watch("type");
  const watchMethod = form.watch("method");

  function submitAction(values: FormValues) {
    if (isPending) return;

    startTransition(async () => {
      try {
        const promise = new Promise((resolve) => setTimeout(resolve, 1000));
        onSubmit?.(values);
        toast.promise(promise, {
          loading: "Saving...",
          success: () => JSON.stringify(values),
          error: "Failed to save",
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
          <FormCardContent className="grid gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
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
                    >
                      <FormItem className="relative flex cursor-pointer flex-row items-center gap-3 rounded-md border border-input px-2 py-3 text-center shadow-xs outline-none transition-[color,box-shadow] has-aria-[invalid=true]:border-destructive has-data-[state=checked]:border-primary/50 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
                        <FormControl>
                          <RadioGroupItem value="HTTP" className="sr-only" />
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
                      <FormItem className="relative flex cursor-pointer flex-row items-center gap-3 rounded-md border border-input px-2 py-3 text-center shadow-xs outline-none transition-[color,box-shadow] has-aria-[invalid=true]:border-destructive has-data-[state=checked]:border-primary/50 has-focus-visible:border-ring has-focus-visible:ring-[3px] has-focus-visible:ring-ring/50">
                        <FormControl>
                          <RadioGroupItem value="TCP" className="sr-only" />
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
          {watchType === "HTTP" && (
            <>
              <FormCardContent className="grid grid-cols-4 gap-4">
                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem className="col-span-1">
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
                          {METHODS.map((method) => (
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
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem className="col-span-3">
                      <FormLabel>URL</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="https://openstatus.dev"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
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
                {watchMethod === "POST" && (
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
                      {field.value.map((_, index) => (
                        <div key={index} className="grid gap-2 sm:grid-cols-5">
                          <FormField
                            control={form.control}
                            name={`assertions.${index}.type`}
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
                            name={`assertions.${index}.eq`}
                            render={({ field }) => (
                              <FormItem>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <SelectTrigger className="w-full">
                                    <SelectValue placeholder="Select eq" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {ASSERTION_EQ.map((eq) => (
                                      <SelectItem key={eq} value={eq}>
                                        {eq}
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
                            name={`assertions.${index}.value`}
                            render={({ field }) => (
                              <FormItem>
                                <Input
                                  placeholder="Value"
                                  className="col-span-2 w-full"
                                  {...field}
                                />
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
                      <div>
                        <Button
                          size="sm"
                          variant="outline"
                          type="button"
                          onClick={() => {
                            field.onChange([
                              ...field.value,
                              { type: "status", value: "" },
                            ]);
                          }}
                        >
                          <Plus />
                          Add Assertion
                        </Button>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </FormCardContent>
            </>
          )}
          {watchType === "TCP" && (
            <FormCardContent className="grid gap-4">
              <FormField
                control={form.control}
                name="url"
                render={({ field }) => (
                  <FormItem>
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
              <div className="text-muted-foreground text-sm">
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
              Learn more about <Link href="#">Monitor Type</Link> and{" "}
              <Link href="#">Assertions</Link>.
            </FormCardFooterInfo>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Submitting..." : "Submit"}
            </Button>
          </FormCardFooter>
        </FormCard>
      </form>
      <DevTool control={form.control} />
    </Form>
  );
}
