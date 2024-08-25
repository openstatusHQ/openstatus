"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
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
  Separator,
} from "@openstatus/ui";

import { LoadingAnimation } from "@/components/loading-animation";
import { toast } from "@/lib/toast";
import {
  latencyFormatter,
  type RegionChecker,
  regionFormatter,
} from "@/components/ping-response-analysis/utils";
import { notEmpty } from "@/lib/utils";
import { Icons } from "@/components/icons";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { Loader } from "lucide-react";

/**
 * IDEA:
 * - add a 'redirect' button or allow user to have 'simple' analytics check instead of detailed page
 */

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
  const [result, setResult] = useState<RegionChecker[]>([]);

  function onSubmit(data: FormSchema) {
    startTransition(async () => {
      const { url, method } = data;
      try {
        async function fetchAndReadStream() {
          // reset the array
          setResult([]);

          const toastId = toast.loading("Loading data from regions...", {
            duration: Number.POSITIVE_INFINITY,
          });

          try {
            const response = await fetch("/play/checker/api", {
              method: "POST",
              body: JSON.stringify({ url, method }),
            });
            const reader = response?.body?.getReader();
            if (!reader) return;

            const decoder = new TextDecoder();

            let done = false;
            let currentResult: RegionChecker[] = [];

            while (!done) {
              const { value, done: streamDone } = await reader.read();
              done = streamDone;
              if (value) {
                const decoded = decoder.decode(value, { stream: true });
                // console.log(decoded);
                const _result = decoded
                  .split("\n")
                  .map((region) => {
                    try {
                      const parsed = JSON.parse(region) as RegionChecker;
                      return parsed;
                    } catch {
                      return undefined;
                    }
                  })
                  .filter(notEmpty);

                console.log(_result?.map((r) => r.region));

                currentResult = [...currentResult, ..._result];
                // setResult((prev) => [...prev, ..._result]);
                setResult(currentResult);

                if (_result.length) {
                  toast.loading(
                    `Checking ${regionFormatter(_result[_result.length - 1].region, "long")} (${currentResult.length}/${flyRegions.length})`,
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
    <>
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
      <div>
        <StatusIndicator loading={isPending} result={result} />
        <Separator className="my-2" />
        <ul className="grid gap-2">
          {result.map((item) => (
            <li
              key={item.region}
              className="flex items-center justify-between text-sm"
            >
              <p className="font-medium text-muted-foreground">
                {regionFormatter(item.region, "long")}
              </p>
              <p className="font-mono">{latencyFormatter(item.latency)}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

function StatusIndicator({
  loading,
  result,
}: {
  loading?: boolean;
  result?: unknown[];
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p>
          Loading{" "}
          <span className="text-muted-foreground text-xs">
            ({result?.length}/{flyRegions.length})
          </span>
        </p>
        <Loader className="h-4 w-4 animate-spin" />
      </div>
    );
  }
  if (result?.length) {
    return (
      <div className="flex items-center justify-between gap-2">
        <p>Loaded</p>
        <div className="rounded-full bg-green-500 p-1">
          <Icons.check className="h-3 w-3 text-background" />
        </div>
      </div>
    );
  }

  return null;
}
