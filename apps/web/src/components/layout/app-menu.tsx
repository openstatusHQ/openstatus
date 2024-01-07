"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { Menu } from "lucide-react";

import {
  Button,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@openstatus/ui";

import { AppSidebar } from "./app-sidebar";

export function AppMenu() {
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // biome-ignore lint/correctness/useExhaustiveDependencies:
  React.useEffect(() => {
    setOpen(false);
  }, [pathname, searchParams]); // remove searchParams if not needed

  return (
    <Sheet open={open} onOpenChange={(value) => setOpen(value)}>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline">
          <Menu className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="top" className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="ml-2 text-left">Menu</SheetTitle>
        </SheetHeader>
        <div className="flex-1">
          <AppSidebar />
        </div>
      </SheetContent>
    </Sheet>
  );
}
