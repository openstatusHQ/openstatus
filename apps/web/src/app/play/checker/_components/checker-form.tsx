"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
  redirect,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod";

import {
  Alert,
  AlertDescription,
  AlertTitle,
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
} from "@openstatus/ui";

import { Icons } from "@/components/icons";
import { LoadingAnimation } from "@/components/loading-animation";
import {
  type RegionChecker,
  is32CharHex,
  latencyFormatter,
  regionFormatter,
} from "@/components/ping-response-analysis/utils";
import useUpdateSearchParams from "@/hooks/use-update-search-params";
import { toast } from "@/lib/toast";
import { flyRegions } from "@openstatus/db/src/schema/constants";
import { FileSearch, Loader } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";

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
  redirect: z.boolean().default(true),
});

type FormSchema = z.infer<typeof formSchema>;

export function CheckerForm() {
  const pathname = usePathname();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<FormSchema>({
    resolver: zodResolver(formSchema),
    defaultValues: { method: "GET", url: "", redirect: false }, // make the url a prop that can be passed via search param
  });
  const [result, setResult] = useState<RegionChecker[]>([]);
  const updateSearchParams = useUpdateSearchParams();
  const searchParams = useSearchParams();

  const id = useMemo(() => {
    return searchParams.get("id");
  }, [searchParams]);

  function onSubmit(data: FormSchema) {
    startTransition(async () => {
      const { url, method, redirect } = data;
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
                // REMINDER: validation
                // console.log(decoded);

                if (is32CharHex(decoded)) {
                  if (redirect) {
                    router.push(`/play/checker/${decoded}`);
                    toast.success("Data is available! Redirecting...", {
                      id: toastId,
                      duration: 2000,
                    });
                  } else {
                    const searchParams = updateSearchParams({ id: decoded });
                    router.replace(`${pathname}?${searchParams}`);
                    toast.success("Data is available!", {
                      id: toastId,
                      duration: 3000,
                      description: "Click the button below to more.",
                      action: {
                        label: "Details",
                        onClick: () => router.push(`/play/checker/${decoded}`),
                      },
                    });
                  }
                  continue;
                }

                const _result = JSON.parse(decoded) as RegionChecker;

                currentResult = [...currentResult, _result];
                // setResult((prev) => [...prev, ..._result]);
                setResult(currentResult);

                if (_result) {
                  toast.loading(
                    `Checking ${regionFormatter(_result.region, "long")} (${latencyFormatter(_result.latency)})`,
                    {
                      id: toastId,
                    },
                  );
                }
              }
            }
          } catch (e) {
            console.log(e);
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
              <Button disabled={isPending} className="h-10 w-full">
                {isPending ? <LoadingAnimation /> : "Check"}
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
        <TableResult result={result} loading={isPending} />
        <DotLegend />
      </div>

      <FloatingActionNoSSR id={id} />

      {!isPending && id ? (
        <Alert>
          <FileSearch className="h-4 w-4" />
          <AlertTitle>Extended Details</AlertTitle>
          <AlertDescription>
            Check it out!{" "}
            <Link
              href={`/play/checker/${id}`}
              className="font-mono text-foreground underline underline-offset-4 hover:no-underline"
            >
              {id}
            </Link>
          </AlertDescription>
        </Alert>
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
