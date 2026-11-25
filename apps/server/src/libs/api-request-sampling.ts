import type { CliInfo } from "@/libs/cli-telemetry";

/** Share of non-CLI `api_request` events sent to OpenPanel. */
export const API_REQUEST_SAMPLE_RATE = 0.1;

/**
 * The sample rate to stamp on this request's `api_request` event, or
 * `undefined` when the event is dropped. CLI requests are always kept so CLI
 * usage stays exact; everything else is sampled at `API_REQUEST_SAMPLE_RATE`.
 * Volumes are recovered by weighting each event by `1 / sampleRate`.
 */
export function apiRequestSampleRate(
  cli: CliInfo | undefined,
): number | undefined {
  if (cli) return 1;
  return Math.random() < API_REQUEST_SAMPLE_RATE
    ? API_REQUEST_SAMPLE_RATE
    : undefined;
}
