import { redirect } from "next/navigation";

import { setPrefixUrl } from "./utils";

export default function Page({ params }: { params: { domain: string } }) {
  const url = setPrefixUrl("/status", params);
  return redirect(url);
}
