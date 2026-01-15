"use client";

import { IconCloudProvider } from "@/components/icon-cloud-provider";
import {
  type Timing,
  getTimingPhases,
  is32CharHex,
  latencyFormatter,
  regionCheckerSchema,
  regionFormatter,
} from "@/components/ping-response-analysis/utils";
import { toast } from "@/lib/toast";
import { cn, notEmpty } from "@/lib/utils";
import {
  AVAILABLE_REGIONS,
  type Region,
  regionDict,
} from "@openstatus/regions";
import { Button } from "@openstatus/ui";
import { Input } from "@openstatus/ui";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@openstatus/ui";
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
import { searchParamsParsers } from "./search-params";

type Values = { region: string; latency: number; status: number; timing?: Timing };

type CheckerContextType = {
  values: Values[];
  setValues: React.Dispatch<React.SetStateAction<Values[]>>;
  id: string | null;
  setId: React.Dispatch<React.SetStateAction<string | null>>;
};

const CheckerContext = createContext<CheckerContextType>({
  values: [],
  setValues: () => {},
  id: null,
  setId: () => {},
});

export function CheckerProvider({
  children,
  defaultValues = [],
}: {
  children: React.ReactNode;
  defaultValues?: Values[];
}) {
  const [values, setValues] = useState<Values[]>(defaultValues);
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
    <CheckerContext.Provider value={{ values, setValues, id, setId: updateId }}>
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
  const { setValues, setId } = useCheckerContext();
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
    setId(null); // This will also clear the URL param

    startTransition(async () => {
      async function fetchAndReadStream() {
        let toastId: string | number | undefined;
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

          clearTimeout(timeoutId);

          const reader = response?.body?.getReader();
          if (!reader) return;

          const decoder = new TextDecoder();
          let done = false;

          while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            if (value) {
              const decoded = decoder.decode(value, { stream: true });
              if (!decoded) continue;

              const array = decoded.split("\n").filter(Boolean);

              const results = array
                .map((item) => {
                  try {
                    // Store the ID if it's a 32-char hex string
                    if (is32CharHex(item)) {
                      setId(item);
                      toast.success("Data is available!", {
                        id: toastId,
                        description: "Learn about the response details.",
                        action: {
                          label: "Details",
                          onClick: () => router.push(`/play/checker/${item}`),
                        },
                        duration: 4000,
                      });
                      return null;
                    }

                    const parsed = JSON.parse(item);
                    const validation = regionCheckerSchema.safeParse(parsed);
                    if (!validation.success) return null;

                    const check = validation.data;
                    // Only process successful checks
                    if (check.state === "success") {
                      return {
                        region: check.region,
                        latency: check.latency,
                        status: check.status,
                        timing: check.timing,
                      };
                    }
                    return null;
                  } catch {
                    return null;
                  }
                })
                .filter(notEmpty);

              if (results.length > 0) {
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
        } catch (error) {
          console.error("Error fetching data:", error);
          if (error instanceof Error && error.name === "AbortError") {
            toast.error("Request timeout", {
              id: toastId,
              description:
                "The request took too long and was aborted after 7 seconds.",
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
            <SelectTrigger className="h-auto! w-full rounded-none p-4 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="rounded-none">
              {["GET", "POST", "PUT", "DELETE", "PATCH"].map((method) => (
                <SelectItem
                  key={method}
                  value={method}
                  className="rounded-none px-2 py-3"
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
            className="h-auto! rounded-none p-4 text-base md:text-base"
            defaultValue={defaultUrl}
            required
          />
        </div>
        <div className="col-span-3 sm:col-span-1">
          <Button
            type="submit"
            variant="default"
            className="h-full w-full rounded-none p-4 text-base"
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
  const { values } = useCheckerContext();
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
          {values.length === 0 ? (
            <tr>
              <td>
                <IconCloudProvider
                  provider="globe"
                  className="size-4 text-muted-foreground"
                />
              </td>
              <td>
                <div className="size-4 bg-muted-foreground" />
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
                      className="size-4"
                    />
                  </td>
                  <td>
                    <div
                      className={cn(
                        "size-4",
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
        </tbody>
        <caption>
          Results of your check ({values.length} / {AVAILABLE_REGIONS.length}{" "}
          regions)
        </caption>
      </table>
    </div>
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
      className="h-full w-full rounded-none p-4 text-base"
      asChild
    >
      <Link
        href={`/play/checker/${id}`}
        className="no-underline! text-background!"
      >
        Response details
      </Link>
    </Button>
  );
}

function convertToCSV(values: Values[]): string {
  const headers = [
    "Region Code",
    "Location",
    "Provider",
    "Latency (ms)",
    "Status",
    "DNS (ms)",
    "Connect (ms)",
    "TLS (ms)",
    "TTFB (ms)",
    "Transfer (ms)",
  ];
  const rows = values.map((value) => {
    const regionConfig = regionDict[value.region as Region];
    const timing = value.timing ? getTimingPhases(value.timing) : null;
    return [
      regionConfig.code,
      regionConfig.location,
      regionConfig.provider,
      value.latency.toString(),
      value.status.toString(),
      timing?.dns.toString() ?? "",
      timing?.connection.toString() ?? "",
      timing?.tls.toString() ?? "",
      timing?.ttfb.toString() ?? "",
      timing?.transfer.toString() ?? "",
    ].join(",");
  });
  return [headers.join(","), ...rows].join("\n");
}

export function CopyToCSVButton() {
  const { values } = useCheckerContext();

  if (values.length === 0) {
    return null;
  }

  async function handleCopy() {
    const csv = convertToCSV(values);
    try {
      await navigator.clipboard.writeText(csv);
      toast.success("CSV copied to clipboard");
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  }

  return (
    <Button
      variant="outline"
      className="h-full w-full rounded-none p-4 text-base"
      onClick={handleCopy}
    >
      Copy to CSV
    </Button>
  );
}
