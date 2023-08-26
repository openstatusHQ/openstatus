"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Wand2, X } from "lucide-react";
import { useFieldArray, useForm } from "react-hook-form";
import * as z from "zod";

import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/trpc/client";
import { LoadingAnimation } from "../loading-animation";

const methods = ["POST", "GET"] as const;
const methodsEnum = z.enum(methods);

const headersSchema = z
  .array(z.object({ key: z.string(), value: z.string() }))
  .optional();

const advancedSchema = z.discriminatedUnion("method", [
  z.object({
    method: z.literal("GET"),
    body: z.string().length(0).optional(),
    headers: headersSchema,
  }),
  z.object({
    method: z.literal("POST"),
    body: z.string().optional(),
    headers: headersSchema,
  }),
]);

type AdvancedMonitorProps = z.infer<typeof advancedSchema>;

interface Props {
  defaultValues?: AdvancedMonitorProps;
  workspaceSlug: string;
}

export function AdvancedMonitorForm({ defaultValues, workspaceSlug }: Props) {
  const form = useForm<AdvancedMonitorProps>({
    resolver: zodResolver(advancedSchema),
    defaultValues: {
      headers: defaultValues?.headers ?? [{ key: "", value: "" }],
      body: defaultValues?.body ?? "",
      method: defaultValues?.method ?? "GET",
    },
  });
  const method = form.watch("method");
  const router = useRouter();
  const searchParams = useSearchParams();
  const monitorId = searchParams.get("id");
  console.log(defaultValues);
  const [isPending, startTransition] = React.useTransition();

  const { fields, append, remove } = useFieldArray({
    name: "headers",
    control: form.control,
  });

  const onSubmit = ({ ...props }: AdvancedMonitorProps) => {
    startTransition(async () => {
      console.log(props);
      if (!monitorId) return;
      if (validateJSON(props.body) === false) return;
      await api.monitor.updateMonitorAdvanced.mutate({
        id: Number(monitorId),
        ...props,
      });
      router.refresh();
      // router.push("./"); // TODO: we need a better UX flow here.
    });
  };

  const validateJSON = (value?: string) => {
    if (!value) return;
    try {
      const obj = JSON.parse(value) as Record<string, unknown>;
      form.clearErrors("body");
      return obj;
    } catch (e) {
      form.setError("body", {
        message: "Not a valid JSON object",
      });
      return false;
    }
  };

  const onPrettifyJSON = () => {
    const body = form.getValues("body");
    const obj = validateJSON(body);
    if (obj) {
      const pretty = JSON.stringify(obj, undefined, 4);
      form.setValue("body", pretty);
    }
  };

  console.log(form.formState.errors);

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="grid w-full grid-cols-1 items-center gap-6 sm:grid-cols-6"
      >
        <div className="space-y-2 sm:col-span-full">
          <FormLabel>Request Header</FormLabel>
          {/* TODO: add FormDescription for latest key/value */}
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-6 gap-6">
              <FormField
                control={form.control}
                name={`headers.${index}.key`}
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormControl>
                      <Input placeholder="key" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="col-span-4 flex items-center space-x-2">
                <FormField
                  control={form.control}
                  name={`headers.${index}.value`}
                  render={({ field }) => (
                    <FormItem className="w-full">
                      <FormControl>
                        <Input placeholder="value" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => remove(Number(field.id))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ key: "", value: "" })}
            >
              Add Custom Header
            </Button>
          </div>
        </div>
        <FormField
          control={form.control}
          name="method"
          render={({ field }) => (
            <FormItem className="sm:col-span-2 sm:col-start-1 sm:self-baseline">
              <FormLabel>Method</FormLabel>
              <Select
                onValueChange={(value) => {
                  field.onChange(methodsEnum.parse(value));
                  form.resetField("body");
                }}
                defaultValue={field.value}
              >
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {methods.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormDescription>What method to use?</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        {method === "POST" && (
          <div className="sm:col-span-4 sm:col-start-1">
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <div className="flex items-end justify-between">
                    <FormLabel>Body</FormLabel>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={onPrettifyJSON}
                          >
                            <Wand2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Prettify JSON</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <FormControl>
                    <Textarea
                      rows={8}
                      placeholder='{ "hello": "world" }'
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>Write your json payload.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}
        <div className="sm:col-span-full">
          <Button className="w-full sm:w-auto">
            {!isPending ? "Confirm" : <LoadingAnimation />}
          </Button>
        </div>
      </form>
    </Form>
  );
}
