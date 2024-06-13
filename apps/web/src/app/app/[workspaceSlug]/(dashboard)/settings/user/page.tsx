"use client";

import { useSession } from "next-auth/react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Input,
  Label,
} from "@openstatus/ui";

import Loading from "./loading";

export default function UserPage() {
  const session = useSession();

  if (!session.data?.user) {
    return <Loading />;
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="grid max-w-sm gap-3">
        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="fullname">Full name</Label>
          <Input id="fullname" value={`${session.data.user?.name}`} disabled />
        </div>
        <div className="grid w-full items-center gap-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={`${session.data.user?.email}`}
            disabled
          />
        </div>
        {/* <div className="flex flex-wrap items-end gap-2">
          <div className="grid items-center gap-1.5">
            <Label htmlFor="avatar">Image</Label>
            <Input id="avatar" type="file" className="w-56" disabled />
          </div>
          <Avatar className="h-10 w-10">
            <AvatarImage
              src={session.data.user?.photoUrl || undefined}
              alt={`${session.data.user?.name}`}
            />
            <AvatarFallback></AvatarFallback>
          </Avatar>
        </div> */}
      </div>
    </div>
  );
}
