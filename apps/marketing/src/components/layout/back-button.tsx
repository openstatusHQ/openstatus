import { ChevronLeft } from "lucide-react";
import type { LinkProps } from "next/link";
import Link from "next/link";

import { Button } from "@openstatus/ui/src/components/button";

interface BackButtonProps extends LinkProps {
  children?: React.ReactNode;
}

export const BackButton = ({ href, children }: BackButtonProps) => {
  return (
    <Button variant="link" asChild>
      <Link href={href} className="group mb-1">
        <ChevronLeft className="mr-1 h-4 w-4 text-muted-foreground group-hover:text-foreground" />{" "}
        {children || "Back"}
      </Link>
    </Button>
  );
};
