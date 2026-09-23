"use client";

import { Close } from "@openstatus/icons";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@openstatus/ui/components/ui/sidebar";

import { usePaymentMethodSetup } from "@/hooks/use-payment-method-setup";

export function NavBannerTrial({
  workspaceSlug,
  daysLeft,
  handleClose,
}: {
  workspaceSlug: string;
  daysLeft: number;
  handleClose: () => void;
}) {
  const paymentMethodSetup = usePaymentMethodSetup(workspaceSlug);

  return (
    <SidebarGroup className="bg-background rounded-lg border px-2 py-1.5 group-data-[collapsible=icon]:hidden">
      <SidebarGroupLabel className="flex h-7 items-center justify-between pr-0 pl-0">
        <span>
          Trial ends in {daysLeft === 1 ? "1 day" : `${daysLeft} days`}
        </span>
        <SidebarMenuAction
          onClick={handleClose}
          className="relative top-0 right-0"
        >
          <Close className="text-muted-foreground" size={16} />
        </SidebarMenuAction>
      </SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem className="text-muted-foreground text-sm">
          Add a payment method to keep Starter. Without one, the workspace moves
          to the free plan.
        </SidebarMenuItem>
        <SidebarMenuItem className="pt-1">
          <SidebarMenuButton
            className="justify-center border"
            data-active="true"
            disabled={paymentMethodSetup.isPending}
            onClick={paymentMethodSetup.start}
          >
            Add payment method
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
