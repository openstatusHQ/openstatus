"use client";

import { UserButton, useUser } from "@clerk/nextjs";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Avatar,
  AvatarFallback,
  AvatarImage,
  Input,
  Label,
  Separator,
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
      <div className="grid max-w-sm gap-3">
        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="fullname">Full name</Label>
          <Input id="fullname" value={`${user.fullName}`} disabled />
        </div>
        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={`${user.emailAddresses?.[0].emailAddress}`}
            disabled
          />
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid items-center gap-1.5">
            <Label htmlFor="avatar">Image</Label>
            <Input id="avatar" type="file" className="w-56" disabled />
          </div>
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.imageUrl} alt={`${user.fullName}`} />
            <AvatarFallback></AvatarFallback>
          </Avatar>
        </div>
      </div>
      <Separator />
      <Alert className="max-w-2xl">
        <Icons.user className="h-4 w-4" />
        <AlertTitle>Manage User</AlertTitle>
        <AlertDescription className="flex gap-4">
          <p>
            We are using Clerk as our authentication provider. You can manage
            your profile via the user portal. Click on your avatar on the right
            to access it.
          </p>
          <div>
            <div className="border-primary rounded-full border p-0.5">
              <UserButton />
            </div>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
}
