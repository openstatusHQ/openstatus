"use client";

import { Button } from "@openstatus/ui";
import * as Portal from "@radix-ui/react-portal";
import { ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";

export function FloatingAction({ id }: { id: string | null }) {
  if (!id) return null;

  return (
    <Portal.Root>
      <div className="group fixed right-4 bottom-4 z-50 mx-auto w-fit">
        <Button asChild>
          <Link href={`/play/checker/${id}`}>
            <span className="mr-1">Response Details</span>
            <ArrowRight className="relative mb-[1px] inline h-4 w-0 transition-all group-hover:w-4" />
            <ChevronRight className="relative mb-[1px] inline h-4 w-4 transition-all group-hover:w-0" />
          </Link>
        </Button>
      </div>
    </Portal.Root>
  );
}
