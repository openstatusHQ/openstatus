"use client";

import { useRouter } from "next/navigation";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@openstatus/ui";

export function Modal({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      router.back();
    }
  };

  return (
    <Dialog open onOpenChange={handleOpenChange}>
      {/* overflow-auto should happen inside content table */}
      <DialogContent className="max-h-[80%] w-full overflow-auto sm:max-w-3xl sm:p-8">
        <DialogHeader>
          <DialogTitle>Details</DialogTitle>
          <DialogDescription>
            Response details of the request.
          </DialogDescription>
        </DialogHeader>
        {children}
      </DialogContent>
    </Dialog>
  );
}
