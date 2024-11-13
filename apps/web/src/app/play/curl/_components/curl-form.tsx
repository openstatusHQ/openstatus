"use client";

import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "@/lib/toast";
import { copyToClipboard } from "@/lib/utils";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Button,
  Checkbox,
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Textarea,
} from "@openstatus/ui";
import { X } from "lucide-react";
import { useCallback } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import { z } from "zod";

const methods = ["GET", "POST", "PUT", "PATCH", "DELETE"] as const;

const formSchema = z.object({
  method: z.enum(methods).default("GET"),
  url: z.string().url().default(""),
  body: z.string().default(""),
  verbose: z.boolean().default(false),
  insecure: z.boolean().default(false),
  json: z.boolean().default(false),
  headers: z
    .array(z.object({ key: z.string(), value: z.string() }))
    .default([]),
});

export function CurlForm({
  defaultValues,
}: {
  defaultValues?: z.infer<typeof formSchema>;
}) {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });
  const { fields, append, remove } = useFieldArray({
    name: "headers",
    control: form.control,
  });

  const formValues = form.watch();
  const debouncedformValues = useDebounce(formValues, 300);

  const onSubmit = useCallback((values: z.infer<typeof formSchema>) => {
    copyToClipboard(generateCurlCommand(values));
    toast("CURL copied to clipboard");
  }, []);

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
        <FormField
          control={form.control}
          name="method"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Method</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Select an HTTP method" />
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
              <FormDescription>
                Specify the request method to use.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="url"
          render={({ field }) => (
            <FormItem>
              <FormLabel>URL</FormLabel>
              <FormControl>
                <Input placeholder="https://openstat.us" {...field} />
              </FormControl>
              <FormDescription>The URL to send the request to.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-2 sm:col-span-full">
          <FormLabel>Request Header</FormLabel>
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-6 gap-4">
              <FormField
                control={form.control}
                name={`headers.${index}.key`}
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormControl>
                      <Input placeholder="Authorization" {...field} />
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
                        <Input placeholder="Bearer <your-token>" {...field} />
                      </FormControl>
                    </FormItem>
                  )}
                />
                <Button
                  size="icon"
                  variant="ghost"
                  type="button"
                  onClick={() => remove(index)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => append({ key: "", value: "" })}
            >
              Add a custom header
            </Button>
          </div>
        </div>
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Body</FormLabel>
              <FormControl>
                <Textarea
                  placeholder={`{ "status": "operational" }`}
                  {...field}
                />
              </FormControl>
              <FormDescription>
                The data payload to send with the request.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Separator />
        <FormField
          control={form.control}
          name="json"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>JSON Content-Type</FormLabel>
                <FormDescription>
                  Set the <code>Content-Type</code> header to{" "}
                  <code>application/json</code>.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="verbose"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Verbose</FormLabel>
                <FormDescription>
                  Make the operation more talkative.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="insecure"
          render={({ field }) => (
            <FormItem className="flex flex-row items-start space-x-3 space-y-0">
              <FormControl>
                <Checkbox
                  checked={field.value}
                  onCheckedChange={field.onChange}
                />
              </FormControl>
              <div className="space-y-1 leading-none">
                <FormLabel>Accept self-signed certificats</FormLabel>
                <FormDescription>
                  Allow insecure server connections.
                </FormDescription>
              </div>
            </FormItem>
          )}
        />
        <Separator />
        <Textarea
          value={generateCurlCommand(debouncedformValues)}
          className="font-mono"
          aria-readonly
          readOnly
        />
        <Button type="submit" className="w-full">
          Copy to Clipboard
        </Button>
      </form>
    </Form>
  );
}

function generateCurlCommand(form: z.infer<typeof formSchema>) {
  const { method, url, body, verbose, insecure, json, headers } = form;

  let curlCommand = "curl";

  if (method) {
    curlCommand += ` -X ${method}`;
  }

  if (url) {
    curlCommand += ` "${url}" \\\n`;
  } else {
    // force a new line if there is no URL
    curlCommand += " \\\n";
  }

  for (const header of headers) {
    const { key, value } = header;
    if (key && value) {
      curlCommand += `  -H "${key}: ${value}" \\\n`;
    }
  }

  if (json) {
    curlCommand += '  -H "Content-Type: application/json" \\\n';
  }

  if (body?.trim()) {
    curlCommand += `  -d '${body.trim()}' \\\n`;
  }

  if (verbose) {
    curlCommand += "  -v \\\n";
  }

  if (insecure) {
    curlCommand += "  -k \\\n";
  }

  // Remove the trailing ` \` at the end
  return curlCommand.trim().slice(0, -2);
}
