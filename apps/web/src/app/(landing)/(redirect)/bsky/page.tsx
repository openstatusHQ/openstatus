import { redirect } from "next/navigation";

export default function BlueskyRedirect() {
  return redirect("https://bsky.app/profile/openstatus.dev");
}
