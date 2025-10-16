"use client";

import {
  DataTableSheet,
  DataTableSheetContent,
  DataTableSheetFooter,
  DataTableSheetHeader,
  DataTableSheetTitle,
} from "@/components/data-table/data-table-sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import type { RouterOutputs } from "@openstatus/api";
import type { PrivateLocation } from "@openstatus/db/src/schema";
import { Check, Copy } from "lucide-react";
import { DataTableBasics } from "./data-table-basics";

type ResponseLog = RouterOutputs["tinybird"]["get"]["data"][number];

export function Sheet({
  data,
  privateLocations,
  onClose,
}: {
  data: ResponseLog | null;
  privateLocations?: PrivateLocation[];
  onClose: () => void;
}) {
  const { copy, isCopied } = useCopyToClipboard();
  if (!data) return null;

  return (
    <DataTableSheet defaultOpen onOpenChange={(open) => !open && onClose()}>
      <DataTableSheetContent className="sm:max-w-lg">
        <DataTableSheetHeader className="px-2">
          <DataTableSheetTitle>Response Logs</DataTableSheetTitle>
        </DataTableSheetHeader>
        <DataTableBasics data={data} privateLocations={privateLocations} />
        <Separator />
        <DataTableSheetFooter>
          <Button
            variant="outline"
            onClick={() => {
              if (typeof window !== "undefined") {
                copy(window.location.href, {
                  withToast: false,
                });
              }
            }}
          >
            Copy Request Log URL
            {isCopied ? <Check /> : <Copy />}
          </Button>
        </DataTableSheetFooter>
      </DataTableSheetContent>
    </DataTableSheet>
  );
}
