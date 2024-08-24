"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import {
  Button,
  Form,
  FormControl,
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
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { toast } from "@/lib/toast";
import { regionFormatter } from "@/components/ping-response-analysis/utils";

const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;

const formSchema = z.object({
  url: z.string().url(), // add pattern and use InputWithAddon `https://`
  method: z.enum(METHODS).default("GET"),
});

type FormSchema = z.infer<typeof formSchema>;

export function CheckerForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { method: "GET", url: "" },
  });

  function onSubmit(data: FormSchema) {
    startTransition(async () => {
      const { url, method } = data;
      try {
        async function fetchAndReadStream() {
          const toastId = toast.loading("Loading data from regions...", {
            duration: Number.POSITIVE_INFINITY,
          });
          try {
            const response = await fetch("/play/checker/api", {
              method: "POST",
              body: JSON.stringify({ url, method }),
            });
            const reader = response?.body?.getReader();
            const decoder = new TextDecoder();

            let done = false;

            while (!done && reader) {
              const { value, done: streamDone } = await reader.read();
              done = streamDone;
              if (value) {
                const decoded = decoder.decode(value);
                // console.log(decoded);
                const parsed = JSON.parse(decoded);
                console.log(parsed);
                if (parsed?.fetch === "pending") {
                  toast.loading(
                    `Checking ${regionFormatter(parsed.region, "long")} (${parsed.index})`,
                    {
                      id: toastId,
                    }
                  );
                }
              }
            }
            toast.success("Done!", { id: toastId, duration: 2000 });
          } catch (e) {
            console.log(e);
            toast.error("Something went wrong", {
              id: toastId,
              duration: 2000,
            });
          }
        }

        await fetchAndReadStream();
      } catch (e) {
        // TODO: better error handling, including e.g. toast
        form.setError("url", { message: "Something went wrong" });
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
          <FormField
            control={form.control}
            name="method"
            render={({ field }) => (
              <FormItem className="col-span-1">
                <FormLabel className="sr-only">Method</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
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
                <FormLabel className="sr-only">URL</FormLabel>
                <FormControl>
                  <Input placeholder="https://documenso.com" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <div className="col-span-full mt-2 sm:col-span-1">
            <Button disabled={isPending} className="h-10 w-full">
              {isPending ? <LoadingAnimation /> : "Check"}
            </Button>
          </div>
        </div>
      </form>
    </Form>
  );
}
