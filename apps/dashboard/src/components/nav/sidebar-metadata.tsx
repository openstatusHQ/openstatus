import type { LucideIcon } from "lucide-react";
import { ChevronRight, MoreHorizontal } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { QuickActions } from "@/components/dropdowns/quick-actions";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@openstatus/ui/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@openstatus/ui/components/ui/sidebar";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@openstatus/ui/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@openstatus/ui/components/ui/tooltip";
import { useCopyToClipboard } from "@openstatus/ui/hooks/use-copy-to-clipboard";
import { cn } from "@openstatus/ui/lib/utils";
import { TooltipProvider } from "@radix-ui/react-tooltip";

export type SidebarMetadataItem = {
  label: string;
  value: React.ReactNode;
  isNested?: boolean;
};

export type SidebarMetadataListItem = {
  /** Stable React key + handle for `active` matching. */
  id: string | number;
  label: React.ReactNode;
  /** Trailing meta on the row (e.g. "2m ago"). */
  meta?: React.ReactNode;
  /** Optional small leading icon. */
  icon?: LucideIcon;
  /** Click target — renders as `next/link` when set. */
  href?: string;
  /** Marks this row as the current selection. */
  active?: boolean;
  /** Hover-revealed `…` button that opens a `QuickActions` dropdown. */
  actions?: {
    id: string;
    label: string;
    icon: LucideIcon;
    variant: "default" | "destructive";
    onClick?: () => Promise<void> | void;
  }[];
  /** Destructive item in the same `…` dropdown, with confirmation dialog. */
  deleteAction?: {
    confirmationValue?: string;
    submitAction: () => Promise<void>;
  };
};

/**
 * Metadata section in `SidebarRight`. Two shapes:
 *  - `type: "table"` (default) — label/value rows with copy-on-tap.
 *  - `type: "list"` — clickable rows with optional active state, leading
 *    icon, trailing meta and a hover-revealed action.
 */
export type SidebarMetadataProps =
  | {
      label: string;
      type?: "table";
      items?: SidebarMetadataItem[];
      /** Shown when `items` is empty. Defaults to "None". */
      emptyMessage?: string;
    }
  | {
      label: string;
      type: "list";
      items?: SidebarMetadataListItem[];
      /** Shown when `items` is empty. Defaults to "None". */
      emptyMessage?: string;
    };

export function SidebarMetadata(props: SidebarMetadataProps) {
  const { label, emptyMessage = "None" } = props;
  return (
    <SidebarGroup className="p-0">
      <Collapsible defaultOpen className="group/collapsible border-b">
        <SidebarGroupLabel
          asChild
          className="group/label h-9 w-full rounded-none text-sidebar-foreground text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <CollapsibleTrigger>
            {label}{" "}
            <ChevronRight className="ml-auto transition-transform group-data-[state=open]/collapsible:rotate-90" />
          </CollapsibleTrigger>
        </SidebarGroupLabel>
        <CollapsibleContent>
          <SidebarGroupContent className="border-t">
            {props.type === "list" ? (
              <SidebarMetadataList
                items={props.items ?? []}
                emptyMessage={emptyMessage}
              />
            ) : (
              <SidebarMetadataTable
                items={props.items ?? []}
                emptyMessage={emptyMessage}
              />
            )}
          </SidebarGroupContent>
        </CollapsibleContent>
      </Collapsible>
    </SidebarGroup>
  );
}

function SidebarMetadataEmpty({ message }: { message: string }) {
  return <p className="px-2 py-2 text-muted-foreground text-sm">{message}</p>;
}

function SidebarMetadataTable({
  items,
  emptyMessage,
}: {
  items: {
    label: string;
    value: React.ReactNode;
    isNested?: boolean;
    tooltip?: string;
  }[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <SidebarMetadataEmpty message={emptyMessage} />;
  }
  return (
    <Table>
      <TableHeader className="sr-only">
        <TableRow>
          <TableHead className="w-26">Label</TableHead>
          <TableHead>Value</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item, index) => (
          <TableRow key={`${item.label}-${index}`}>
            <TableCell className="w-26 border-r text-muted-foreground">
              <div className="min-w-[90px] max-w-[90px] truncate">
                {item.isNested ? "└ " : ""}
                {item.label}
              </div>
            </TableCell>
            <SidebarMetadataTableCell className="max-w-0 truncate font-mono">
              {item.value}
            </SidebarMetadataTableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SidebarMetadataList({
  items,
  emptyMessage,
}: {
  items: SidebarMetadataListItem[];
  emptyMessage: string;
}) {
  if (items.length === 0) {
    return <SidebarMetadataEmpty message={emptyMessage} />;
  }
  return (
    <SidebarGroup className="p-0">
      <SidebarMenu className="gap-0">
        {items.map((item) => {
          const inner = (
            <>
              {item.icon ? <item.icon className="size-3.5 shrink-0" /> : null}
              <span className="flex-1 truncate">{item.label}</span>
              {item.meta != null ? (
                <span className="ml-auto shrink-0 font-mono text-muted-foreground text-xs">
                  {item.meta}
                </span>
              ) : null}
            </>
          );
          const hasMenu =
            (item.actions?.length ?? 0) > 0 || !!item.deleteAction;
          return (
            <SidebarMenuItem key={item.id} className="border-b last:border-b-0">
              <SidebarMenuButton
                asChild
                isActive={item.active}
                // Flat row treatment to match `SidebarMetadataTable`: no
                // rounded corners, edge-to-edge, table-cell padding.
                className="h-9 rounded-none px-2 group-has-data-[sidebar=menu-action]/menu-item:pr-2"
              >
                {item.href ? (
                  <Link href={item.href}>{inner}</Link>
                ) : (
                  <button type="button">{inner}</button>
                )}
              </SidebarMenuButton>
              {hasMenu ? (
                <QuickActions
                  actions={item.actions}
                  deleteAction={item.deleteAction}
                  side="right"
                  align="start"
                >
                  <SidebarMenuAction
                    showOnHover
                    // Solid backdrop + left-side gradient so the dots cover
                    // the meta timestamp underneath when revealed.
                    // `ring-inset` keeps the focus ring within the button so
                    // it doesn't bleed past the sidebar's right edge.
                    // V-center: the default action `top` is driven by a
                    // `peer-data-[size=...]/menu-button` variant tuned for
                    // the shorter button sizes; we use a taller `h-9` row,
                    // so override the variant directly and re-anchor at 50%.
                    className="before:-left-6 -translate-y-1/2 bg-sidebar-accent before:absolute before:inset-y-0 before:right-full before:bg-gradient-to-l before:from-sidebar-accent before:to-transparent focus-visible:ring-inset peer-data-[size=default]/menu-button:top-1/2"
                  >
                    <MoreHorizontal />
                    <span className="sr-only">More</span>
                  </SidebarMenuAction>
                </QuickActions>
              ) : null}
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

function SidebarMetadataTableCell({
  className,
  ...props
}: React.ComponentProps<typeof TableCell>) {
  const ref = React.useRef<HTMLTableCellElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);
  const { copy, isCopied } = useCopyToClipboard();
  const [open, setOpen] = React.useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: <explanation>
  React.useEffect(() => {
    if (ref.current) {
      setIsTruncated(ref.current.scrollWidth > ref.current.clientWidth);
    }
  }, [ref]);

  const handleClick = () => {
    if (typeof props.children === "string") {
      copy(props.children, { withToast: false, timeout: 1000 });
    }
  };

  React.useEffect(() => {
    if (isCopied) setOpen(true);
  }, [isCopied]);

  return (
    <TableCell
      {...props}
      ref={ref}
      className={cn(
        typeof props.children === "string" && "cursor-pointer",
        className,
      )}
      onClick={handleClick}
    >
      <TooltipProvider>
        {isTruncated || isCopied ? (
          <Tooltip open={open} onOpenChange={setOpen}>
            <TooltipTrigger
              // NOTE: all the prevent default events avoid the tooltip to hide and show again
              onClick={(event) => event.preventDefault()}
              onPointerDown={(event) => event.preventDefault()}
              asChild
            >
              <span className="block truncate">{props.children}</span>
            </TooltipTrigger>
            <TooltipContent
              onPointerDownOutside={(event) => event.preventDefault()}
              side="left"
            >
              {isCopied ? "Copied" : props.children}
            </TooltipContent>
          </Tooltip>
        ) : (
          props.children
        )}
      </TooltipProvider>
    </TableCell>
  );
}
