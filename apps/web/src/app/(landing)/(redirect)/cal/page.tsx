import { redirect } from "next/navigation";

export default function CalRedirect() {
  return redirect("http://cal.com/team/openstatus/30min");
}
