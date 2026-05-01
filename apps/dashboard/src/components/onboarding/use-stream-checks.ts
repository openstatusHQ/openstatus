"use client";

import type { CheckResult } from "@openstatus/services/monitor";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

export function useStreamChecks() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const fail = useCallback((message: string) => {
    setError(message);
    setIsStreaming(false);
    toast.error(message);
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const start = useCallback(
    async (monitorId: number) => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      setResults([]);
      setError(null);
      setIsStreaming(true);

      try {
        const res = await fetch("/api/onboarding/checks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ monitorId }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const json = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          fail(json?.error ?? `Stream failed (${res.status})`);
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let nl = buffer.indexOf("\n");
          while (nl !== -1) {
            const line = buffer.slice(0, nl).trim();
            buffer = buffer.slice(nl + 1);
            if (line) {
              try {
                const parsed = JSON.parse(line) as CheckResult;
                setResults((prev) => [...prev, parsed]);
              } catch {
                // ignore partial / malformed lines
              }
            }
            nl = buffer.indexOf("\n");
          }
        }

        if (buffer.trim()) {
          try {
            const parsed = JSON.parse(buffer.trim()) as CheckResult;
            setResults((prev) => [...prev, parsed]);
          } catch {
            // ignore tail
          }
        }
      } catch (err) {
        if ((err as Error)?.name === "AbortError") return;
        fail(err instanceof Error ? err.message : "Stream failed");
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [fail],
  );

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  return { results, isStreaming, error, start, stop };
}
