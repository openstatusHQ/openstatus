"use client";

import { cva } from "class-variance-authority";
import Link from "next/link";
import type { LinkProps } from "next/link";

import { cn } from "@/lib/utils";
import type { ValidIcon } from "../icons";
import { Icons } from "../icons";

const linkVariants = cva(
  "text-muted-foreground group flex w-full min-w-[200px] items-center rounded-md border px-3 py-1",
  {
    variants: {
      variant: {
        default: "hover:bg-muted/50 hover:text-foreground border-transparent",
        active: "bg-muted/50 border-border text-foreground font-medium",
        disabled: "pointer-events-none opacity-60 border-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

interface AppLinkProps extends LinkProps {
  label: string;
  icon?: ValidIcon;
  className?: string;
  active?: boolean;
  disabled?: boolean;
}

export function AppLink({
  label,
  href,
  icon,
  disabled,
  className,
  active,
  ...props
}: AppLinkProps) {
  const Icon = icon && Icons[icon];

  const variant = disabled ? "disabled" : active ? "active" : "default";

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
