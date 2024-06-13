import type { webVitalEvents } from "./config";

export type WebVitalEvents = (typeof webVitalEvents)[number];

export type WebVitalsValueTypes = "good" | "needs-improvement" | "poor";

export type WebVitalsValues = {
  type: WebVitalsValueTypes;
  label: string;
  min: number;
  max: number;
}[];

export type WebVitalsConfig = Record<
  WebVitalEvents,
  {
    unit: string;
    label: string;
    description: string;
    values: WebVitalsValues;
  }
>;
