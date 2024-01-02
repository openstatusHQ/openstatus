"use client";

import Link from "next/link";
import type { LinkProps } from "next/link";
import { useSelectedLayoutSegment } from "next/navigation";
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";
import type { ValidIcon } from "../icons";
import { Icons } from "../icons";

const linkVariants = cva(
  "text-muted-foreground group flex w-full min-w-[200px] items-center rounded-md border px-3 py-1",
  {
    variants: {
      variant: {
        default: "hover:bg-muted/50 hover:text-foreground border-transparent",
        active: "bg-muted/50 border-border text-foreground",
        disabled: "pointer-events-none opacity-60",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface AppLinkProps extends LinkProps {
  label: string;
  segment?: string | null;
  icon?: ValidIcon;
  className?: string;
  disabled?: boolean;
}

export function AppLink({
  label,
  href,
  icon,
  disabled,
  className,
  segment,
  ...props
}: AppLinkProps) {
  const selectedSegment = useSelectedLayoutSegment();
  const Icon = icon && Icons[icon];

  const isActive = segment === selectedSegment;
  const variant = disabled ? "disabled" : isActive ? "active" : "default";

  return (
    <Link
      href={href}
      className={cn(linkVariants({ variant, className }))}
      aria-disabled={disabled}
      {...props}
    >
      {Icon ? <Icon className={cn("mr-2 h-4 w-4")} /> : null}
      {label}
    </Link>
  );
}
