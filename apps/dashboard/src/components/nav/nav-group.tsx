"use client";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@openstatus/ui/components/ui/sidebar";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { StatusDot, type StatusVariant } from "@/components/common/status-dot";
import type { NavItem } from "@/config/nav";
import { cn } from "@/lib/utils";

function topSegment(url: string) {
  return url.split("/")[1] ?? "";
}

/**
 * py-1 keeps groups on the 36px row grid: item (32) + 4 + 4 + label (32)
 * spans two rows (with no gap on `SidebarContent`), so a `NavPeek` beside
 * the sidebar stays aligned.
 */
export function NavGroup({
  label,
  children,
  className,
  ...props
}: React.ComponentProps<typeof SidebarGroup> & { label?: string }) {
  return (
    <SidebarGroup
      data-slot="nav-group"
      className={cn("py-1", className)}
      {...props}
    >
      {label ? (
        // collapsed, the label is invisible and pulled up over the previous
        // group's last item; let the pointer through to that item
        <SidebarGroupLabel className="group-data-[collapsible=icon]:pointer-events-none">
          {label}
        </SidebarGroupLabel>
      ) : null}
      <SidebarMenu>{children}</SidebarMenu>
    </SidebarGroup>
  );
}

export function NavGroupItem(
  props: React.ComponentProps<typeof SidebarMenuItem>,
) {
  return <SidebarMenuItem data-slot="nav-group-item" {...props} />;
}

/** The item's link, or a muted button with a "coming soon" tooltip when `item.disabled`. */
export function NavGroupButton({
  item,
  tooltip = true,
  className,
  ...props
}: Omit<React.ComponentProps<typeof SidebarMenuButton>, "tooltip"> & {
  item: NavItem;
  /** false when something else (a peek card) already explains the item */
  tooltip?: boolean;
}) {
  const pathname = usePathname();
  const { setOpenMobile } = useSidebar();
  if (item.disabled) {
    return (
      <SidebarMenuButton
        data-slot="nav-group-button"
        aria-disabled
        // keep pointer events so the collapsed tooltip can open
        className={cn(
          "font-commit-mono text-muted-foreground hover:text-muted-foreground active:text-muted-foreground tracking-tight hover:bg-transparent active:bg-transparent aria-disabled:pointer-events-auto aria-disabled:cursor-default aria-disabled:opacity-100",
          className,
        )}
        // like every sidebar tooltip, only when collapsed: expanded, the badge says it
        tooltip={`${item.label} is coming soon`}
        {...props}
      >
        <item.icon />
        <span>{item.label}</span>
      </SidebarMenuButton>
    );
  }
  const current = topSegment(pathname);
  return (
    <SidebarMenuButton
      data-slot="nav-group-button"
      isActive={current !== "" && current === topSegment(item.href)}
      asChild
      tooltip={tooltip ? item.label : undefined}
      className={className}
      {...props}
    >
      <Link
        href={item.href}
        onClick={() => setOpenMobile(false)}
        className="font-commit-mono tracking-tight"
      >
        <item.icon />
        <span>{item.label}</span>
      </Link>
    </SidebarMenuButton>
  );
}

function NavGroupBadge({
  className,
  ...props
}: React.ComponentProps<typeof SidebarMenuBadge>) {
  return (
    <SidebarMenuBadge
      data-slot="nav-group-badge"
      className={cn(
        "font-commit-mono text-muted-foreground gap-1.5",
        // a disabled item's badge stays muted when its button is hovered
        "peer-aria-disabled/menu-button:peer-hover/menu-button:text-muted-foreground",
        className,
      )}
      {...props}
    />
  );
}

/** Status dot with an optional count, e.g. how many monitors need attention. */
export function NavGroupStatus({
  variant,
  count,
  label,
  ...props
}: React.ComponentProps<typeof SidebarMenuBadge> & {
  variant: StatusVariant;
  count?: number;
  /** screen-reader text, e.g. "2 monitors need attention" */
  label: string;
}) {
  return (
    <NavGroupBadge data-slot="nav-group-status" {...props}>
      {count ? <span aria-hidden="true">{count}</span> : null}
      <StatusDot variant={variant} />
      <span className="sr-only">{label}</span>
    </NavGroupBadge>
  );
}

/** Default rendering of a config item: its button plus its text badge. */
export function NavGroupDefaultItem({ item }: { item: NavItem }) {
  return (
    <NavGroupItem>
      <NavGroupButton item={item} />
      {item.badge ? <NavGroupBadge>{item.badge}</NavGroupBadge> : null}
    </NavGroupItem>
  );
}
