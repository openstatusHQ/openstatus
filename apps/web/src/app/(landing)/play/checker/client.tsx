"use client";

import {
  AVAILABLE_REGIONS,
  type Region,
  regionDict,
} from "@openstatus/regions";
import { Button } from "@openstatus/ui/components/ui/button";
import { Input } from "@openstatus/ui/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui/components/ui/select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryStates } from "nuqs";
import {
  createContext,
  useContext,
  useEffect,
  useState,
  useTransition,
} from "react";

import { IconCloudProvider } from "../../../../components/icon-cloud-provider";
import {
  latencyFormatter,
  regionFormatter,
} from "../../../../lib/checker/utils";
import { APP_URL } from "../../../../lib/metadata/shared-metadata";
import { toast } from "../../../../lib/toast";
import { cn } from "../../../../lib/utils";
import {
  type CheckerFailure,
  type CheckerSuccess,
  parseCheckerLine,
  splitStreamLines,
} from "./parse";
import { searchParamsParsers } from "./search-params";
import { handleExportCSV } from "./utils";

type Values = CheckerSuccess;

type CheckerContextType = {
  values: Values[];
  setValues: React.Dispatch<React.SetStateAction<Values[]>>;
  failures: CheckerFailure[];
  setFailures: React.Dispatch<React.SetStateAction<CheckerFailure[]>>;
  id: string | null;
  setId: React.Dispatch<React.SetStateAction<string | null>>;
  // URL the current `values` belong to, for the monitor CTA.
  url: string | null;
  setUrl: React.Dispatch<React.SetStateAction<string | null>>;
};

const CheckerContext = createContext<CheckerContextType>({
  values: [],
  setValues: () => {},
  failures: [],
  setFailures: () => {},
  id: null,
  setId: () => {},
  url: null,
  setUrl: () => {},
});

export function CheckerProvider({
  children,
  defaultValues = [],
  defaultUrl = null,
}: {
  children: React.ReactNode;
  defaultValues?: Values[];
  defaultUrl?: string | null;
}) {
  const [values, setValues] = useState<Values[]>(defaultValues);
  const [failures, setFailures] = useState<CheckerFailure[]>([]);
  const [url, setUrl] = useState<string | null>(defaultUrl);
  const [{ id: urlId }, setSearchParams] = useQueryStates(searchParamsParsers);
  const [id, setId] = useState<string | null>(urlId);

  // Sync local ID state with URL search params
  useEffect(() => {
    setId(urlId);
  }, [urlId]);

  // Helper function to update both local state and URL
  const updateId: React.Dispatch<React.SetStateAction<string | null>> = async (
    newId,
  ) => {
    const value = typeof newId === "function" ? newId(id) : newId;
    setId(value);
    await setSearchParams({ id: value });
  };

  return (
    <CheckerContext.Provider
      value={{
        values,
        setValues,
        failures,
        setFailures,
        id,
        setId: updateId,
        url,
        setUrl,
      }}
    >
      {children}
    </CheckerContext.Provider>
  );
}

export function useCheckerContext() {
  const context = useContext(CheckerContext);
  if (!context) {
    throw new Error("useCheckerContext must be used within a CheckerProvider");
  }
  return context;
}

export function Form({
  defaultMethod = "GET",
  defaultUrl = "",
}: {
  defaultMethod?: string;
  defaultUrl?: string;
}) {
  const { setValues, setFailures, setId, setUrl } = useCheckerContext();
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    const url = formData.get("url") as string;
    const method = formData.get("method") as string;

    // Validate URL
    try {
      new URL(url);
    } catch {
      // Invalid URL, could add error handling here
      toast.error("Invalid URL");
      return;
    }

    // Reset values and ID
    setValues([]);
    setFailures([]);
    setId(null); // This will also clear the URL param
    setUrl(url);

    startTransition(async () => {
      async function fetchAndReadStream() {
        let toastId: string | number | undefined;
        let resultId: string | null = null;
        let successCount = 0;
        try {
          toastId = toast.loading("Loading data from regions...", {
            duration: Number.POSITIVE_INFINITY,
            closeButton: false,
          });

          const abortController = new AbortController();
          const timeoutId = setTimeout(() => abortController.abort(), 10_000);

          const response = await fetch("/play/checker/api", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ url, method }),
            signal: abortController.signal,
          });

          if (!response.ok) {
            try {
              const json = await response.json();
              toast.error(json.error, {
                id: toastId,
                className: "text-destructive!",
              });
              return;
            } catch {
              toast.error("Failed to fetch data", {
                id: toastId,
                description: "Please try again.",
                className: "text-destructive!",
              });
              return;
            }
          }

          clearTimeout(timeoutId);

          const reader = response?.body?.getReader();
          if (!reader) {
            toast.error("Failed to read response", {
              id: toastId,
              description: "Please try again.",
              className: "text-destructive!",
            });
            return;
          }

          const decoder = new TextDecoder();
          let done = false;
          let buffer = "";

          while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            buffer += value
              ? decoder.decode(value, { stream: true })
              : decoder.decode();
            const { lines, rest } = splitStreamLines(buffer, done);
            buffer = rest;
            if (lines.length > 0) {
              const results: Values[] = [];
              const failed: CheckerFailure[] = [];

              for (const item of lines) {
                const line = parseCheckerLine(item);
                if (!line) continue;
                if (line.type === "id") {
                  setId(line.id);
                  resultId = line.id;
                } else if (line.type === "success") {
                  results.push(line.value);
                } else {
                  failed.push(line.value);
                }
              }

              if (failed.length > 0) {
                setFailures((prev) => [...prev, ...failed]);
              }

              if (results.length > 0) {
                successCount += results.length;
                setValues((prev) => [...prev, ...results]);
                toast.loading(
                  `Checking ${regionFormatter(
                    results[0].region,
                    "long",
                  )} (${latencyFormatter(results[0].latency)})`,
                  {
                    id: toastId,
                  },
                );
              }
            }
          }

          if (successCount === 0) {
            toast.error("No region could reach the target", {
              id: toastId,
              description: "It may be down or blocking our requests.",
              className: "text-destructive!",
            });
          } else {
            toast.success("Data is available!", {
              id: toastId,
              description: "Learn about the response details.",
              ...(resultId
                ? {
                    action: {
                      label: "Details",
                      onClick: () => router.push(`/play/checker/${resultId}`),
                    },
                  }
                : {}),
              duration: 4000,
            });
          }
        } catch (error) {
          console.error("Error fetching data:", error);
          if (error instanceof Error && error.name === "AbortError") {
            toast.error("Request timeout", {
              id: toastId,
              description:
                "The request took too long and was aborted after 10 seconds.",
              className: "text-destructive!",
            });
          } else {
            toast.error("Something went wrong", {
              id: toastId,
              description: "Please try again.",
              className: "text-destructive!",
            });
          }
        }
      }

      await fetchAndReadStream();
    });
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
        <div className="col-span-1">
          <Select name="method" defaultValue={defaultMethod}>
            <SelectTrigger className="h-auto! w-full rounded-none px-3 py-2 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              {["GET", "POST", "PUT", "DELETE", "PATCH"].map((method) => (
                <SelectItem
                  key={method}
                  value={method}
                  className="rounded-none px-3 py-2"
                >
                  {method}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="col-span-2 md:col-span-3">
          <Input
            name="url"
            placeholder="https://openstatus.dev"
            className="h-auto! rounded-none px-3 py-2 text-base md:text-base"
            defaultValue={defaultUrl}
            required
          />
        </div>
        <div className="col-span-3 sm:col-span-1">
          <Button
            type="submit"
            variant="default"
            className="h-full w-full rounded-none px-3 py-2 text-base"
            disabled={isPending}
          >
            {isPending ? "Submitting..." : "Submit"}
          </Button>
        </div>
        {/* TOOD: add button to details */}
      </div>
    </form>
  );
}

export function ResultTable() {
  const { values, failures } = useCheckerContext();
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th className="w-12" />
            <th className="w-12" />
            <th>Region</th>
            <th className="text-right!">Latency</th>
          </tr>
        </thead>
        <tbody>
          {values.length === 0 && failures.length === 0 ? (
            <tr>
              <td>
                <IconCloudProvider
                  provider="globe"
                  className="text-muted-foreground mx-auto size-4"
                />
              </td>
              <td>
                <div className="bg-muted-foreground mx-auto size-4" />
              </td>
              <td>
                <br />
              </td>
              <td>
                <br />
              </td>
            </tr>
          ) : (
            values.map((value) => {
              const regionConfig = regionDict[value.region as Region];
              return (
                <tr key={value.region}>
                  <td>
                    <IconCloudProvider
                      provider={regionConfig.provider}
                      className="mx-auto size-4"
                    />
                  </td>
                  <td>
                    <div
                      className={cn(
                        "mx-auto size-4",
                        STATUS_CODES[
                          value.status.toString()[0] as keyof typeof STATUS_CODES
                        ],
                      )}
                    />
                  </td>
                  <td>
                    {regionConfig.flag} {regionConfig.code}{" "}
                    <span className="text-muted-foreground">
                      {regionConfig.location}
                    </span>
                  </td>
                  <td className="text-right!">
                    {Intl.NumberFormat("en-US", {
                      maximumFractionDigits: 0,
                    }).format(value.latency)}
                    ms
                  </td>
                </tr>
              );
            })
          )}
          {failures.map((failure) => (
            <FailedRow key={failure.region} failure={failure} />
          ))}
        </tbody>
        <caption>
          Results of your check ({values.length + failures.length} /{" "}
          {AVAILABLE_REGIONS.length} regions
          {failures.length > 0 ? `, ${failures.length} failed` : ""})
        </caption>
      </table>
    </div>
  );
}

function FailedRow({ failure }: { failure: CheckerFailure }) {
  const regionConfig = regionDict[failure.region as Region];
  return (
    <tr>
      <td>
        <IconCloudProvider
          provider={regionConfig.provider}
          className="mx-auto size-4"
        />
      </td>
      <td>
        <div className="bg-muted-foreground mx-auto size-4" />
      </td>
      <td>
        {regionConfig.flag} {regionConfig.code}{" "}
        <span className="text-muted-foreground">{regionConfig.location}</span>
      </td>
      <td className="text-right!">
        <span className="text-destructive">Failed</span>
        <span className="text-muted-foreground block text-xs">
          {failure.message}
        </span>
      </td>
    </tr>
  );
}

const STATUS_CODES = {
  "1": "bg-muted-foreground",
  "2": "bg-success",
  "3": "bg-info",
  "4": "bg-warning",
  "5": "bg-destructive",
};

export function ResponseStatus() {
  return (
    <div className="flex gap-2">
      {Object.entries(STATUS_CODES).map(([code, className]) => (
        <div key={code} className={cn("text-background text-base", className)}>
          {code}xx
        </div>
      ))}
    </div>
  );
}

export function DetailsButtonLink() {
  const { values, id } = useCheckerContext();

  // Only show button if we have all regions and an ID
  if (!id || values.length === 0) {
    return null;
  }
  return (
    <Button
      variant="default"
      className="h-auto! flex-1 rounded-none px-3 py-2 text-base"
      asChild
    >
      <Link
        href={`/play/checker/${id}`}
        className="text-background! w-full no-underline!"
      >
        Response details
      </Link>
    </Button>
  );
}

// Below 3× the regions are "even"; above it one region is the story.
const SPREAD_RATIO = 3;

export function MonitorCta() {
  const { values, url } = useCheckerContext();

  if (!url || values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a.latency - b.latency);
  const fastest = sorted[0];
  const slowest = sorted[sorted.length - 1];
  const uneven =
    sorted.length > 1 &&
    fastest.latency > 0 &&
    slowest.latency / fastest.latency >= SPREAD_RATIO;

  const params = new URLSearchParams({ url, ref: "checker" });

  return (
    <div className="border-border bg-muted/30 mt-4 grid gap-4 border p-3 sm:grid-cols-3">
      <div className="sm:col-span-2">
        <p className="my-0! font-semibold">
          {uneven
            ? `${regionFormatter(slowest.region, "long")} answers in ${latencyFormatter(
                slowest.latency,
              )}, ${regionFormatter(fastest.region, "long")} in ${latencyFormatter(
                fastest.latency,
              )}.`
            : sorted.length > 1
              ? "Response times look even across regions."
              : "Only one region responded."}
        </p>
        <p className="text-muted-foreground my-0! text-sm">
          {uneven
            ? "One sample is a snapshot. Monitor this URL from all regions and get alerted when a region degrades. Free."
            : sorted.length > 1
              ? "Keep it that way: monitor this URL on a schedule and get alerted when it slows down or fails. Free."
              : "Monitor this URL on a schedule to see whether the other regions reach it and get alerted when it fails. Free."}
        </p>
      </div>
      <div className="flex items-center sm:col-span-1 sm:justify-end">
        <Button
          asChild
          className="h-auto! w-full rounded-none px-3 py-2 text-base"
        >
          <a
            href={`${APP_URL}/monitors/create?${params.toString()}`}
            target="_blank"
            rel="noreferrer"
            className="text-background! no-underline!"
          >
            Monitor this URL
          </a>
        </Button>
      </div>
    </div>
  );
}

export function ExportToCSVButton() {
  const { values } = useCheckerContext();

  if (values.length === 0) {
    return null;
  }

  return (
    <Button
      variant="outline"
      className="h-auto! flex-1 cursor-pointer rounded-none px-3 py-2 text-base"
      onClick={() => handleExportCSV(values)}
    >
      Export to CSV
    </Button>
  );
}
