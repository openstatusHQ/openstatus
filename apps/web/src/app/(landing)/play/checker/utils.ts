import { type Timing, getTimingPhases } from "@/lib/checker/utils";
import { toast } from "@/lib/toast";
import { type Region, regionDict } from "@openstatus/regions";

export type CheckerRow = {
  region: string;
  latency: number;
  status: number;
  timing: Timing;
};

function escapeCSV(value: string): string {
  // Escape values that contain commas, quotes, or newlines by wrapping in quotes
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function convertToCSV(rows: CheckerRow[]): string {
  const headers = [
    "Region Code",
    "Location",
    "Provider",
    "Latency (ms)",
    "Status",
    "DNS (ms)",
    "Connect (ms)",
    "TLS (ms)",
    "TTFB (ms)",
    "Transfer (ms)",
  ];
  const csvRows = rows.map((row) => {
    const regionConfig = regionDict[row.region as Region];
    const timing = getTimingPhases(row.timing);
    return [
      escapeCSV(regionConfig.code),
      escapeCSV(regionConfig.location),
      escapeCSV(regionConfig.provider),
      row.latency.toString(),
      row.status.toString(),
      timing?.dns.toString() ?? "",
      timing?.connection.toString() ?? "",
      timing?.tls.toString() ?? "",
      timing?.ttfb.toString() ?? "",
      timing?.transfer.toString() ?? "",
    ].join(",");
  });
  return [headers.join(","), ...csvRows].join("\n");
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
  toast.success("CSV exported successfully");
}

export function handleExportCSV(
  rows: CheckerRow[],
  urlForFilename?: string,
): void {
  const csv = convertToCSV(rows);
  const datePart = new Date().toISOString().split("T")[0];

  let filename: string;
  if (urlForFilename) {
    const sanitizedUrl = urlForFilename
      .replace(/^https?:\/\//, "")
      .replace(/[^a-zA-Z0-9.-]/g, "_");
    filename = `checker-${sanitizedUrl}-${datePart}.csv`;
  } else {
    filename = `checker-results-${datePart}.csv`;
  }

  downloadCSV(csv, filename);
}
