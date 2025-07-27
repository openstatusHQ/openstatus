"use client";

import { NavBreadcrumb } from "@/components/nav/nav-breadcrumb";
import { Cog, CreditCard, User } from "lucide-react";

export function Breadcrumb() {
  return (
    <NavBreadcrumb
      items={[
        { type: "page", label: "Settings" },
        {
          type: "select",
          items: [
            { value: "general", label: "General", icon: Cog },
            { value: "account", label: "Account", icon: User },
            { value: "billing", label: "Billing", icon: CreditCard },
          ],
        },
      ]}
    />
  );
}
