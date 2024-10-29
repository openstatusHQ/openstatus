"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
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
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { LoadingAnimation } from "@/components/loading-animation";
import {
  type RegionChecker,
  is32CharHex,
  latencyFormatter,
  regionCheckerSchema,
  regionFormatter,
} from "@/components/ping-response-analysis/utils";
import { toast } from "@/lib/toast";
import { notEmpty } from "@/lib/utils";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { ArrowRight, ChevronRight, Gauge, Info, Loader } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useQueryStates } from "nuqs";
import { searchParamsParsers } from "../search-params";

const FloatingActionNoSSR = dynamic(
  () =>
    import("../_components/floating-action").then((mod) => mod.FloatingAction),
  {
    ssr: false,
    loading: () => <></>,
  },
);

/**
 * IDEA we can create a list of last requests and show them in a list, but
 * we will have to sync both expiration dates, for redis and localStorage
 */

const METHODS = ["GET", "POST", "PUT", "DELETE"] as const;

const formSchema = z.object({
  url: z.string().url(),
  method: z.enum(METHODS).default("GET"),
  redirect: z.boolean().default(false),
});

type FormSchema = z.infer<typeof formSchema>;

interface CheckerFormProps {
  defaultValues?: FormSchema;
  defaultData?: RegionChecker[];
}

export function CheckerForm({ defaultValues, defaultData }: CheckerFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues,
  });
  const [result, setResult] = useState<RegionChecker[]>(defaultData || []);
  const [{ id }, setSearchParams] = useQueryStates(searchParamsParsers);

  function onSubmit(data: FormSchema) {
    startTransition(async () => {
      const { url, method, redirect } = data;
      try {
        async function fetchAndReadStream() {
          // reset the array
          setResult([]);

          const toastId = toast.loading("Loading data from regions...", {
            duration: Number.POSITIVE_INFINITY,
            closeButton: false,
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
                // REMINDER: validation

                if (!decoded) continue;

                const array = decoded.split("\n").filter(Boolean);

                const _result = array
                  .map((item) => {
                    try {
                      if (is32CharHex(item)) {
                        if (redirect) {
                          router.push(`/play/checker/${item}`);
                          toast.success("Data is available! Redirecting...", {
                            id: toastId,
                            duration: 2000,
                          });
                        } else {
                          setSearchParams({ id: item });
                          toast.success("Data is available!", {
                            id: toastId,
                            duration: 3000,
                            description: "Click the button below to more.",
                            action: {
                              label: "Details",
                              onClick: () =>
                                router.push(`/play/checker/${item}`),
                            },
                          });
                        }
                      } else {
                        const parsed = JSON.parse(item);
                        const validation =
                          regionCheckerSchema.safeParse(parsed);
                        if (!validation.success) return null;
                        return validation.data;
                      }
                      return null;
                    } catch (_e) {
                      return null;
                    }
                  })
                  .filter(notEmpty);

                if (!_result.length) continue;

                currentResult = [...currentResult, ..._result];
                // setResult((prev) => [...prev, ..._result]);
                setResult(currentResult);

                if (_result) {
                  toast.loading(
                    `Checking ${regionFormatter(_result[0].region, "long")} (${latencyFormatter(_result[0].latency)})`,
                    {
                      id: toastId,
                    },
                  );
                }
              }
            }
          } catch (_e) {
            setSearchParams({ id: null });
            toast.error("Something went wrong", {
              description: "Please try again",
              id: toastId,
              duration: 2000,
            });
          }
        }

        await fetchAndReadStream();
      } catch (_e) {
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
                    <Input
                      placeholder="https://documenso.com"
                      className="bg-muted"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="col-span-full mt-2 sm:col-span-1">
              <Button disabled={isPending} className="group h-10 w-full">
                {isPending ? (
                  <LoadingAnimation />
                ) : (
                  <>
                    Check{" "}
                    <Gauge className="[&>*:first-child]:-rotate-90 ml-1 h-4 w-4 [&>*:first-child]:origin-[12px_14px] [&>*:first-child]:transition-transform [&>*:first-child]:duration-500 [&>*:first-child]:ease-out [&>*:first-child]:group-hover:rotate-0" />
                  </>
                )}
              </Button>
            </div>
          </div>
          <div>
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
                    <FormLabel>Redirect to extended details</FormLabel>
                    <FormDescription className="max-w-md">
                      Get response header, timing phases and more.
                    </FormDescription>
                  </div>
                </FormItem>
              )}
            />
          </div>
        </form>
      </Form>
      <div className="grid gap-4">
        <TableResult result={result} loading={isPending} id={id} />
        <DotLegend />
        {id ? (
          <Button variant="secondary" className="group" asChild>
            <Link href={`/play/checker/${id}`}>
              <span className="mr-1">Response Details</span>
              <ArrowRight className="relative mb-[1px] inline h-4 w-0 transition-all group-hover:w-4" />
              <ChevronRight className="relative mb-[1px] inline h-4 w-4 transition-all group-hover:w-0" />
            </Link>
          </Button>
        ) : null}
      </div>

      <FloatingActionNoSSR id={id} />
    </>
  );
}

function TableResult({
  result,
  loading,
  id,
}: {
  loading: boolean;
  result: RegionChecker[];
  id: string | null;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="flex items-center gap-1">
            <p className="w-[95px]">
              Region{" "}
              <span className="font-normal text-xs tabular-nums">
                ({result.length}/{flyRegions.length})
              </span>
            </p>
            {loading ? (
              <Loader className="inline h-4 w-4 animate-spin" />
            ) : result.length ? (
              <Icons.check className="inline h-4 w-4 text-green-500" />
            ) : null}
            {id &&
            !loading &&
            result.length > 0 &&
            result.length !== flyRegions.length ? (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="h-4 w-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent className="text-muted-foreground">
                    <p>Not all regions were hit.</p>
                    <p>
                      Still{" "}
                      <Link
                        href={`/play/checker/${id}`}
                        className="text-foreground underline underline-offset-4 hover:no-underline"
                      >
                        check the results
                      </Link>
                      ?
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ) : null}
          </TableHead>
          <TableHead className="w-[100px] text-right">Latency</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {result.length > 0 ? (
          result.map((item) => (
            <TableRow key={item.region}>
              <TableCell className="flex items-center gap-2 font-medium">
                {regionFormatter(item.region, "long")}
                <StatusDot value={item.status} />
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

function DotLegend() {
  return (
    <div className="flex items-center justify-center gap-3 text-center">
      {[1, 2, 3, 4, 5].map((i) => (
        <div
          key={i}
          className="flex items-center justify-between gap-2 font-mono text-muted-foreground text-xs"
        >
          <StatusDot value={i * 100} />
          <span>{i}xx</span>
        </div>
      ))}
    </div>
  );
}

function StatusDot({ value }: { value: number }) {
  switch (String(value).charAt(0)) {
    case "1":
      return <div className="h-1.5 w-1.5 rounded-full bg-gray-500" />;
    case "2":
      return <div className="h-1.5 w-1.5 rounded-full bg-green-500" />;
    case "3":
      return <div className="h-1.5 w-1.5 rounded-full bg-blue-500" />;
    case "4":
      return <div className="h-1.5 w-1.5 rounded-full bg-yellow-500" />;
    case "5":
      return <div className="h-1.5 w-1.5 rounded-full bg-red-500" />;
    default:
      return <div className="h-1.5 w-1.5 rounded-full bg-gray-500" />;
  }
}
