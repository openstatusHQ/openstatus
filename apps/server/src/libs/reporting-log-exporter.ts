import type { LogRecordExporter } from "@opentelemetry/sdk-logs";

type ExportResultCallback = Parameters<LogRecordExporter["export"]>[1];

/**
 * Wraps a LogRecordExporter so failed export batches are logged through
 * logtape instead of being dropped silently. The OTLP SDK's default
 * failure path is a no-op in production, which made an Axiom outage
 * indistinguishable from health.
 */
export class ReportingLogExporter implements LogRecordExporter {
  constructor(
    private readonly inner: LogRecordExporter,
    private readonly report: (error: Error) => void,
  ) {}

  export(
    logs: Parameters<LogRecordExporter["export"]>[0],
    resultCallback: ExportResultCallback,
  ): void {
    this.inner.export(logs, (result) => {
      if (result.code !== 0) {
        this.report(result.error ?? new Error("unknown export failure"));
      }
      resultCallback(result);
    });
  }

  shutdown(): Promise<void> {
    return this.inner.shutdown();
  }
}
