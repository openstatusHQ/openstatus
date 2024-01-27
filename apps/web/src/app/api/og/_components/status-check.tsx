import type { StatusVariant } from "@/lib/tracker";
import { cn } from "@/lib/utils";

export function StatusCheck({
  variant,
}: {
  variant: StatusVariant | "incident";
}) {
  function getVariant() {
    switch (variant) {
      case "down":
        return {
          color: "bg-red-500",
          label: "Major Outage",
          icon: Minus,
        };
      case "degraded":
        return {
          color: "bg-yellow-500",
          label: "Systems Degraded",
          icon: Minus,
        };
      case "incident":
        return {
          color: "bg-yellow-500",
          label: "Incident Ongoing",
          icon: Alert,
        };
      default:
        return {
          color: "bg-green-500",
          label: "All Systems Operational",
          icon: Check,
        };
    }
  }

  const { icon, color, label } = getVariant();

  return (
    <div tw="flex flex-col justify-center items-center gap-2 w-full">
      <div tw={cn("flex text-white rounded-full p-3", color)}>{icon()}</div>
      <p style={{ fontFamily: "Cal" }} tw="text-4xl">
        {label}
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
