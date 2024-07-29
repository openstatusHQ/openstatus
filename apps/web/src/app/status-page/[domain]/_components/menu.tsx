"use client";

import { MenuIcon } from "lucide-react";
import { usePathname, useSelectedLayoutSegment } from "next/navigation";
import * as React from "react";

import { Button } from "@openstatus/ui/src/components/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@openstatus/ui/src/components/sheet";

import { AppLink } from "@/components/layout/app-link";

interface Props {
  navigation: {
    label: string;
    href: string;
    segment: string | null;
    disabled?: boolean;
  }[];
}

export function Menu({ navigation }: Props) {
  const selectedSegment = useSelectedLayoutSegment();
  const [open, setOpen] = React.useState(false);
  const pathname = usePathname();

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  React.useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <Sheet open={open} onOpenChange={(value) => setOpen(value)}>
      <SheetTrigger asChild>
        <Button
          size="icon"
          variant="outline"
          className="rounded-full"
          aria-label="menu"
        >
          <MenuIcon className="h-6 w-6" />
        </Button>
      </SheetTrigger>
      <SheetContent side="top" className="flex flex-col">
        <SheetHeader>
          <SheetTitle className="ml-2 text-left">Menu</SheetTitle>
        </SheetHeader>
        <ul className="grid gap-1">
          {navigation.map(({ href, label, segment, disabled }) => {
            const active = segment === selectedSegment;
            return (
              <li key={href} className="w-full">
                <AppLink {...{ href, label, active, disabled }} />
              </li>
            );
          })}
        </ul>
      </SheetContent>
    </Sheet>
  );
}
