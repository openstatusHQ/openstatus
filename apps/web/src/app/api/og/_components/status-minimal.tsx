import { ogColors } from "./uptime-bars";

export function StatusMinimal({
  title,
  domain,
}: {
  title: string;
  domain: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 34,
        width: "100%",
        height: "100%",
        background: ogColors.bg,
        color: ogColors.fg,
        fontFamily: "Inter",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: ogColors.mfg,
            boxShadow: `0 0 0 12px ${ogColors.mfg}29`,
          }}
        />
        <span style={{ fontFamily: "Cal", fontSize: 84, letterSpacing: -2.5 }}>
          {title}
        </span>
      </div>
      <span
        style={{
          fontFamily: "CommitMono",
          fontSize: 17,
          color: ogColors.mfg,
          letterSpacing: 0.34,
        }}
      >
        {domain}
      </span>
    </div>
  );
}
