import type { StatusVariant } from "@openstatus/tracker";

import { type DayCell, safeIconUrl } from "../page/aggregate";
import { UptimeBars, ogColors } from "./uptime-bars";

const variantContent: Record<
  StatusVariant,
  { eyebrow: string; accent: string; iconBg: string; iconColor: string }
> = {
  up: {
    eyebrow: "LIVE",
    accent: ogColors.ok,
    iconBg: ogColors.ok,
    iconColor: "#0b120c",
  },
  degraded: {
    eyebrow: "DEGRADED",
    accent: ogColors.warn,
    iconBg: ogColors.warn,
    iconColor: "#1c1204",
  },
  down: {
    eyebrow: "OUTAGE",
    accent: ogColors.err,
    iconBg: ogColors.err,
    iconColor: "#2b0505",
  },
  incident: {
    eyebrow: "DOWNTIME",
    accent: ogColors.err,
    iconBg: ogColors.err,
    iconColor: "#2b0505",
  },
  maintenance: {
    eyebrow: "MAINTENANCE",
    accent: ogColors.info,
    iconBg: ogColors.info,
    iconColor: "#0b1226",
  },
  empty: {
    eyebrow: "STATUS",
    accent: ogColors.mfg,
    iconBg: ogColors.mfg,
    iconColor: "#171717",
  },
};

export function StatusHero({
  title,
  icon,
  variant,
  statusLong,
  subline,
  lookbackDays,
  days,
}: {
  title: string;
  icon: string | null;
  variant: StatusVariant;
  statusLong: string;
  subline: string | null;
  lookbackDays: number;
  days: DayCell[];
}) {
  const content = variantContent[variant];
  const iconUrl = safeIconUrl(icon);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        width: "100%",
        height: "100%",
        padding: "60px 64px",
        background: ogColors.bg,
        color: ogColors.fg,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {iconUrl ? (
            <img
              src={iconUrl}
              width={52}
              height={52}
              style={{ borderRadius: 12 }}
            />
          ) : (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 52,
                height: 52,
                borderRadius: 12,
                background: ogColors.fg,
                color: ogColors.bg,
                fontFamily: "CommitMono",
                fontWeight: 700,
                fontSize: 30,
              }}
            >
              {(Array.from(title)[0] ?? "?").toUpperCase()}
            </div>
          )}
          <span style={{ fontSize: 26, fontWeight: 500, letterSpacing: -0.26 }}>
            {title}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: 999,
              background: content.accent,
              boxShadow: `0 0 0 5px ${content.accent}47`,
            }}
          />
          <span
            style={{
              fontFamily: "CommitMono",
              fontSize: 15,
              letterSpacing: 2.1,
              color: variant === "up" ? ogColors.mfg : content.accent,
            }}
          >
            {content.eyebrow}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 26 }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 76,
            height: 76,
            borderRadius: 14,
            background: content.iconBg,
            color: content.iconColor,
          }}
        >
          {variant === "up" ? <Check /> : <Alert />}
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <span
            style={{
              fontFamily: "Cal",
              fontSize: 56,
              letterSpacing: -1.12,
              lineHeight: 1.05,
            }}
          >
            {statusLong}
          </span>
          {subline ? (
            <span
              style={{
                fontFamily: "CommitMono",
                fontSize: 17,
                color: ogColors.mfg,
                marginTop: 8,
              }}
            >
              {subline}
            </span>
          ) : null}
        </div>
      </div>

      <UptimeBars days={days} placeholderCount={lookbackDays} />
    </div>
  );
}

function Check() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Alert() {
  return (
    <svg
      width="44"
      height="44"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v9" />
      <path d="M12 18.5h.01" />
    </svg>
  );
}
