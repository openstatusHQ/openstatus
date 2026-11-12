import { redirect } from "next/navigation";

import { SLA_POLICY_TABS } from "./constants";

export default function Page() {
  redirect(SLA_POLICY_TABS[0].href);
}
