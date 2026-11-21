"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

// Browsers cached a permanent redirect from /history to here, so a server
// redirect back would loop. A client navigation is not served from that cache.
export default function Page() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  useEffect(() => {
    router.replace(`/status-pages/${id}/history${window.location.search}`);
  }, [id, router]);
  return null;
}
