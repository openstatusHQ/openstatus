import { redirect } from "next/navigation";

import { REPORTING_TABS } from "./constants";

export default function Page() {
  redirect(REPORTING_TABS[0].href);
}
