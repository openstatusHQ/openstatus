"use client";

import { useRouter } from "next/navigation";

export default function RefreshRoute() {
  const router = useRouter();
  router.refresh();
  return <></>;
}
