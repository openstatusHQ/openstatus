"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { Button } from "../ui/button";

export const BackButton = () => {
  const router = useRouter();
  return (
    <Button variant="link" className="group mb-1" onClick={router.back}>
      <ChevronLeft className="text-muted-foreground group-hover:text-foreground mr-1 h-4 w-4" />{" "}
      Back
    </Button>
  );
};
