import type { Tracker } from "@openstatus/tracker";

import { cn } from "@/lib/utils";

export function StatusCheck({ tracker }: { tracker: Tracker }) {
  const details = tracker.currentDetails;

  // FIXME: move icons into @openstatus/tracker lib
  function getVariant() {
    switch (details.variant) {
      case "maintenance":
        return Hammer;
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

  // REMINDER: we cannot use custom tailwind utility colors like `bg-status-operational/90` here
  function getClassName() {
    switch (details.variant) {
      case "maintenance":
        return "bg-blue-500/90 border-blue-500";
      case "down":
        return "bg-rose-500/90 border-rose-500";
      case "degraded":
        return "bg-amber-500/90 border-amber-500";
      case "incident":
        return "bg-rose-500/90 border-rose-500";
      default:
        return "bg-green-500/90 border-green-500";
    }
  }

  const Icon = getVariant();

  return (
    <div tw="flex flex-col justify-center items-center w-full">
      <div
        tw={cn(
          "flex text-white rounded-full p-3 border-2 mb-2",
          getClassName(),
        )}
      >
        <Icon />
      </div>
      <p style={{ fontFamily: "Cal" }} tw="text-4xl">
        {details.long}
      </p>
    </div>
  );
}

function Hammer() {
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
      <path d="m15 12-8.373 8.373a1 1 0 1 1-3-3L12 9" />
      <path d="m18 15 4-4" />
      <path d="m21.5 11.5-1.914-1.914A2 2 0 0 1 19 8.172V7l-2.26-2.26a6 6 0 0 0-4.202-1.756L9 2.96l.92.82A6.18 6.18 0 0 1 12 8.4V10l2 2h1.172a2 2 0 0 1 1.414.586L18.5 14.5" />
    </svg>
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
