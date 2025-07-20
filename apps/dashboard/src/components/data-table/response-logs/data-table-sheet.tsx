"use client";

import {
  DataTableSheet,
  DataTableSheetContent,
  DataTableSheetFooter,
  DataTableSheetHeader,
  DataTableSheetTitle,
} from "@/components/data-table/data-table-sheet";
import { Button } from "@/components/ui/button";
import { Check, Copy } from "lucide-react";
import type { RouterOutputs } from "@openstatus/api";
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard";
import { Separator } from "@/components/ui/separator";
import { DataTableBasics } from "./data-table-basics";

type ResponseLog = RouterOutputs["tinybird"]["get"]["data"][number];

export function Sheet({
  data,
  onClose,
}: {
  data: ResponseLog | null;
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
        <DataTableBasics data={data} />
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
