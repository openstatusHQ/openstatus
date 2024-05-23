import type { Tracker } from "@openstatus/tracker";

import { cn } from "@/lib/utils";

export function StatusCheck({ tracker }: { tracker: Tracker }) {
  const details = tracker.currentDetails;
  const className = tracker.currentClassName;

  // FIXME: move icons into @openstatus/tracker lib
  function getVariant() {
    switch (details.variant) {
      case "down":
        return Minus;
      case "degraded":
        return Minus;
      case "incident":
        return Alert;
      default:
        return Check;
    }
  }

  const Icon = getVariant();

  return (
    <div tw="flex flex-col justify-center items-center w-full">
      <div tw={cn("flex text-white rounded-full p-3 border-2 mb-2", className)}>
        <Icon />
      </div>
      <p style={{ fontFamily: "Cal" }} tw="text-4xl">
        {details.long}
      </p>
    </div>
  );
}

function Check() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Minus() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="M5 12h14" />
    </svg>
  );
}

function Alert() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="40"
      height="40"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </svg>
  );
}
