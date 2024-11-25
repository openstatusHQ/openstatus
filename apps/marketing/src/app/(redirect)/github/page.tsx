import { redirect } from "next/navigation";

export default function GithubRedirect() {
  return redirect("https://github.com/openstatusHQ/openstatus");
}
