"use client";

import { Button } from "@openstatus/ui/components/ui/button";
import { Input } from "@openstatus/ui/components/ui/input";
import { useQueryStates } from "nuqs";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import type { CdnRegionResponse, CdnSummary } from "@/lib/cdn-checker/schema";
import {
  cdnRegionResponseSchema,
  cdnSummarySchema,
} from "@/lib/cdn-checker/schema";
import { regionFormatter } from "@/lib/checker/utils";
import { toast } from "@/lib/toast";

import { searchParamsParsers } from "./search-params";

type CdnCheckerContextType = {
  rows: CdnRegionResponse[];
  summary: CdnSummary | null;
  checkedUrl: string | null;
  isPending: boolean;
  runCheck: (url: string) => void;
};

// null default so out-of-provider usage throws instead of silently no-oping
const CdnCheckerContext = createContext<CdnCheckerContextType | null>(null);

export function useCdnChecker() {
  const context = useContext(CdnCheckerContext);
  if (!context) {
    throw new Error("useCdnChecker must be used within a CdnCheckerProvider");
  }
  return context;
}

export function CdnCheckerProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [rows, setRows] = useState<CdnRegionResponse[]>([]);
  const [summary, setSummary] = useState<CdnSummary | null>(null);
  const [checkedUrl, setCheckedUrl] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [{ url: urlParam }, setSearchParams] =
    useQueryStates(searchParamsParsers);
  const autoRan = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  // cancel the in-flight stream when the provider unmounts
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  function runCheck(url: string) {
    try {
      new URL(url);
    } catch {
      toast.error("Invalid URL");
      return;
    }

    // abort the previous check so its stale rows can't interleave with ours
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setRows([]);
    setSummary(null);
    setCheckedUrl(url);
    setSearchParams({ url });

    startTransition(async () => {
      let toastId: string | number | undefined;
      try {
        toastId = toast.loading("Checking cache status from all regions...", {
          duration: Number.POSITIVE_INFINITY,
          closeButton: false,
        });

        const response = await fetch("/play/cdn-checker/api", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
          signal: controller.signal,
        });

        if (!response.ok) {
          try {
            const json = await response.json();
            toast.error(json.error, {
              id: toastId,
              className: "text-destructive!",
            });
          } catch {
            toast.error("Failed to fetch data", {
              id: toastId,
              description: "Please try again.",
              className: "text-destructive!",
            });
          }
          return;
        }

        const reader = response.body?.getReader();
        if (!reader) {
          toast.error("Failed to read response", {
            id: toastId,
            description: "Please try again.",
            className: "text-destructive!",
          });
          return;
        }

        const decoder = new TextDecoder();
        // lines can split across chunks: buffer until a newline arrives
        let buffer = "";
        let done = false;

        while (!done) {
          const { value, done: streamDone } = await reader.read();
          done = streamDone;
          buffer += decoder.decode(value, { stream: !done });

          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.trim()) continue;
            let parsed: unknown;
            try {
              parsed = JSON.parse(line);
            } catch {
              continue;
            }

            const summaryResult = cdnSummarySchema.safeParse(parsed);
            if (
              summaryResult.success &&
              (parsed as { type?: string }).type === "summary"
            ) {
              setSummary(summaryResult.data);
              toast.success(
                `Cached in ${summaryResult.data.cachedRegions} of ${summaryResult.data.respondedRegions} regions`,
                { id: toastId, duration: 4000 },
              );
              continue;
            }

            const rowResult = cdnRegionResponseSchema.safeParse(parsed);
            if (rowResult.success) {
              const row = rowResult.data;
              setRows((prev) => [...prev, row]);
              if (row.state === "success") {
                toast.loading(
                  `${regionFormatter(row.region, "long")}: ${row.cacheStatus}`,
                  { id: toastId },
                );
              }
            }
          }
        }
      } catch (error) {
        // deliberate abort (new submission or unmount) is not an error
        if (controller.signal.aborted) {
          if (toastId !== undefined) toast.dismiss(toastId);
          return;
        }
        console.error("Error fetching data:", error);
        toast.error("Something went wrong", {
          id: toastId,
          description: "Please try again.",
          className: "text-destructive!",
        });
      }
    });
  }

  // ?url= present on mount: re-run the probe live (shareable result links)
  // biome-ignore lint/correctness/useExhaustiveDependencies: run once on mount
  useEffect(() => {
    if (autoRan.current) return;
    autoRan.current = true;
    if (urlParam) runCheck(urlParam);
  }, []);

  return (
    <CdnCheckerContext.Provider
      value={{ rows, summary, checkedUrl, isPending, runCheck }}
    >
      {children}
    </CdnCheckerContext.Provider>
  );
}

export function CdnForm() {
  const { runCheck, isPending } = useCdnChecker();
  const [{ url: urlParam }] = useQueryStates(searchParamsParsers);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.target as HTMLFormElement);
    runCheck(formData.get("url") as string);
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        <div className="col-span-3">
          <Input
            name="url"
            placeholder="https://example.com/asset.js"
            className="h-auto! rounded-none p-4 text-base md:text-base"
            defaultValue={urlParam ?? ""}
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
            {isPending ? "Checking..." : "Check"}
          </Button>
        </div>
      </div>
    </form>
  );
}
