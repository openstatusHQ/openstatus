"use client";

import { UserButton, useUser } from "@clerk/nextjs";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Input,
  Label,
} from "@openstatus/ui";

import { Icons } from "@/components/icons";
import Loading from "./loading";

export default function UserPage() {
  const { user } = useUser();

  if (!user) {
    return <Loading />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid gap-3">
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="fullname">Full name</Label>
          <Input id="fullname" value={`${user.fullName}`} disabled />
        </div>
        <div className="grid w-full max-w-sm items-center gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={`${user.emailAddresses?.[0].emailAddress}`}
            disabled
          />
        </div>
      </div>
      <Alert className="max-w-2xl">
        <Icons.user className="h-4 w-4" />
        <AlertTitle>Manage User</AlertTitle>
        <AlertDescription className="flex gap-4">
          <span>
            We are using clerk as our authentication provider. You can manage
            your profile via the user portal. Click on your avatar to access it.
          </span>
          <UserButton />
        </AlertDescription>
      </Alert>
    </div>
  );
}
