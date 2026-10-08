import { redirect } from "next/navigation";

import RootLoading from "../loading";

export default function Page() {
  redirect("/overview");
  return <RootLoading />;
}
