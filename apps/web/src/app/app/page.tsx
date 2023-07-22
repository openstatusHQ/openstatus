"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Container } from "@/components/dashboard/container";
import { Header } from "@/components/dashboard/header";
import { Skeleton } from "@/components/ui/skeleton";

export default function Page() {
  const router = useRouter();

  // waiting for the workspace to be created
  setTimeout(() => router.refresh(), 1000);

  return (
    <div className="grid gap-6 md:grid-cols-2 md:gap-8">
      <div className="col-span-full flex w-full justify-between">
        <Header.Skeleton>
          <Skeleton className="h-9 w-20" />
        </Header.Skeleton>
      </div>
      <Container.Skeleton />
      <Container.Skeleton />
      <Container.Skeleton />
    </div>
  );
}
