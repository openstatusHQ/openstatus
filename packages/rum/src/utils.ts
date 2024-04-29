import type { WebVitalsValueTypes } from "./config";

export function getColorByType(type: WebVitalsValueTypes) {
  switch (type) {
    case "good":
      return "bg-green-500";
    case "needs-improvement":
      return "bg-yellow-500";
    case "poor":
      return "bg-rose-500";
    default:
      const _check: never = type;
      return _check;
  }
}
