"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { redirect, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

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
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
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
import { Info, Loader } from "lucide-react";
import Link from "next/link";

/**
 * IDEA:
 * - add a 'redirect' button or allow user to have 'simple' analytics check instead of detailed page
 */

const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;

const formSchema = z.object({
  url: z.string().url(),
  method: z.enum(METHODS).default("GET"),
  redirect: z.boolean().default(true),
});

type FormSchema = z.infer<typeof formSchema>;

export function CheckerForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { method: "GET", url: "", redirect: true }, // make the url a prop that can be passed via search param
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

                const _lastResult = _result[_result.length - 1];

                if (_result.length) {
                  toast.loading(
                    `Checking ${regionFormatter(_lastResult.region, "long")} (${latencyFormatter(_lastResult.latency)})`,
                    {
                      id: toastId,
                    }
                  );
                }
              }
            }
            toast.success("Data is available!", {
              id: toastId,
              duration: 2000,
            });
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
        <form onSubmit={form.handleSubmit(onSubmit)} className="grid gap-3">
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
          {/* <div>
            <FormField
              control={form.control}
              name="redirect"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-2 space-y-0">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>Extended details</FormLabel>
                    <FormDescription className="max-w-md">
                      Redirects you to a detailed page with more information
                      like response header, timing phases and charts.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div> */}
        </form>
      </Form>
      <TableResult result={result} loading={isPending} />
      {!isPending && result.length ? (
        <p className="text-center text-muted-foreground text-sm">
          For more details regarding your speed check, click{" "}
          <Link
            href="#"
            className="text-foreground underline underline-offset-4 hover:no-underline"
          >
            here
          </Link>
          .
        </p>
      ) : null}
    </>
  );
}

function TableResult({
  result,
  loading,
}: {
  loading: boolean;
  result: RegionChecker[];
}) {
  return (
    <Table>
      <TableCaption>A list of the regions latency.</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead className="flex w-[135px] items-center justify-between">
            <p>
              Region{" "}
              <span className="font-normal text-xs tabular-nums">
                ({result.length}/{flyRegions.length})
              </span>
            </p>
            {loading ? (
              <Loader className="ml-1 inline h-4 w-4 animate-spin" />
            ) : result.length ? (
              <Icons.check className="ml-1 inline h-4 w-4 text-green-500" />
            ) : null}
          </TableHead>
          <TableHead className="w-[100px] text-right">Latency</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {result.length > 0 ? (
          result.map((item) => (
            <TableRow key={item.region}>
              <TableCell className="font-medium">
                {regionFormatter(item.region, "long")}
              </TableCell>
              <TableCell className="text-right">
                {latencyFormatter(item.latency)}
              </TableCell>
            </TableRow>
          ))
        ) : (
          <TableRow>
            <TableCell
              colSpan={2}
              className="border border-border border-dashed text-center"
            >
              No data available
            </TableCell>
          </TableRow>
        )}
      </TableBody>
    </Table>
  );
}
