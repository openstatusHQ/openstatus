"use client";

import { Download } from "lucide-react";

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@openstatus/ui";

import type { Monitor } from "./data-table-wrapper";

function jsonToCsv(jsonData: Record<string, unknown>[]): string {
  const csvRows: string[] = [];
  const headers = Object.keys(jsonData[0]);

  // Add header row
  csvRows.push(headers.join(","));

  // Add data rows
  for (const row of jsonData) {
    const values = headers.map((header) => {
      const escaped = `${row[header]}`.replace(/"/g, '\\"');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

function downloadCsv(data: string, filename: string) {
  const blob = new Blob([data], { type: "text/csv" });
  const link = document.createElement("a");
  link.href = window.URL.createObjectURL(blob);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function DownloadCSVButton({
  data,
  filename,
}: {
  data: Monitor[];
  filename: string;
}) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            onClick={() => {
              const content = jsonToCsv(data);
              downloadCsv(content, filename);
            }}
          >
            <Download className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Download <code>csv</code> file
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
