"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@openstatus/ui";

interface InfoAlertDialogProps {
  workspaceSlug: string;
  /**
   * Default expiration time in days
   */
  expires?: number;

  id: string;
  title: React.ReactNode;
  description: React.ReactNode;
}

export function InfoAlertDialog({
  workspaceSlug,
  expires = 7,
  id,
  title,
  description,
}: InfoAlertDialogProps) {
  const [open, setOpen] = useState(false);

  function onClick() {
    if (document) {
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + expires);
      // store the cookie for 7 days and only for a specific workspace
      document.cookie = `${id}=true; expires=${expiresAt}; path=/app/${workspaceSlug}`;
    }
    setOpen(false);
  }

  useEffect(() => {
    async function configureProBanner() {
      if (document) {
        const cookie = document.cookie
          .split("; ")
          .find((row) => row.startsWith(id));
        if (!cookie) {
          setOpen(true);
        }
      }
    }
    configureProBanner();
  }, [id]);

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onClick}>Continue</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
