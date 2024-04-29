export type WebVitalEvents = "CLS" | "FCP" | "FID" | "INP" | "LCP" | "TTFB";

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

export const webVitalsConfig: WebVitalsConfig = {
  CLS: {
    unit: "",
    label: "Cumulative Layout Shift",
    description:
      "CLS measures the sum of all individual layout shift scores for every unexpected layout shift that occurs during the entire lifespan of the page.",
    values: [
      {
        type: "good",
        label: "Good",
        min: 0,
        max: 0.1,
      },
      {
        type: "needs-improvement",
        label: "Needs Improvement",
        min: 0.1,
        max: 0.25,
      },
      {
        type: "poor",
        label: "Poor",
        min: 0.25,
        max: Infinity,
      },
    ],
  },
  FCP: {
    unit: "ms",
    label: "First Contentful Paint",
    description:
      "FCP measures the time from when the page starts loading to when any part of the page's content is rendered on the screen.",
    values: [
      {
        type: "good",
        label: "Good",
        min: 0,
        max: 1000,
      },
      {
        type: "needs-improvement",
        label: "Needs Improvement",
        min: 1000,
        max: 2500,
      },
      {
        type: "poor",
        label: "Poor",
        min: 2500,
        max: Infinity,
      },
    ],
  },
  FID: {
    unit: "ms",
    label: "First Input Delay",
    description:
      "FID measures the time from when a user first interacts with a page to the time when the browser is actually able to respond to that interaction.",
    values: [
      {
        type: "good",
        label: "Good",
        min: 0,
        max: 100,
      },
      {
        type: "needs-improvement",
        label: "Needs Improvement",
        min: 100,
        max: 300,
      },
      {
        type: "poor",
        label: "Poor",
        min: 300,
        max: Infinity,
      },
    ],
  },
  INP: {
    unit: "ms",
    label: "Input Delay",
    description:
      "INP measures the time from when a user first interacts with a page to the time when the browser is actually able to respond to that interaction.",
    values: [
      {
        type: "good",
        label: "Good",
        min: 0,
        max: 50,
      },
      {
        type: "needs-improvement",
        label: "Needs Improvement",
        min: 50,
        max: 250,
      },
      {
        type: "poor",
        label: "Poor",
        min: 250,
        max: Infinity,
      },
    ],
  },
  LCP: {
    unit: "ms",
    label: "Largest Contentful Paint",
    description:
      "LCP measures the time from when the page starts loading to when the largest content element is rendered on the screen.",
    values: [
      {
        type: "good",
        label: "Good",
        min: 0,
        max: 2500,
      },
      {
        type: "needs-improvement",
        label: "Needs Improvement",
        min: 2500,
        max: 4000,
      },
      {
        type: "poor",
        label: "Poor",
        min: 4000,
        max: Infinity,
      },
    ],
  },
  TTFB: {
    unit: "ms",
    label: "Time to First Byte",
    description:
      "TTFB measures the time from when the browser starts requesting a page to when the first byte of the page is received by the browser.",
    values: [
      {
        type: "good",
        label: "Good",
        min: 0,
        max: 200,
      },
      {
        type: "needs-improvement",
        label: "Needs Improvement",
        min: 200,
        max: 500,
      },
      {
        type: "poor",
        label: "Poor",
        min: 500,
        max: Infinity,
      },
    ],
  },
};
