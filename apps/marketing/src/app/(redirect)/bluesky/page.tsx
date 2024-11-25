import { redirect } from "next/navigation";

export default function BlueSkyRedirect() {
  return redirect("https://bsky.app/profile/openstatus.dev");
}
