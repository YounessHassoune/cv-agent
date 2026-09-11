"use client";

import Link from "next/link";
import { useRef } from "react";
import { LogOutIcon, SettingsIcon, UserRoundIcon } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  email,
  name,
  image,
  initials,
}: {
  readonly email: string;
  readonly name: string | null;
  readonly image: string | null;
  readonly initials: string;
}) {
  const signOutForm = useRef<HTMLFormElement>(null);

  return (
    <>
      {/* Kept outside the menu on purpose: selecting an item closes the menu and
          unmounts its portal, and a form removed from the document mid-click
          never submits. This one survives, so `requestSubmit` can navigate. */}
      <form action="/api/auth/signout" className="hidden" method="post" ref={signOutForm} />

      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              aria-label="Account menu"
              className="rounded-full outline-none transition-shadow focus-visible:ring-[3px] focus-visible:ring-ring/45"
              type="button"
            >
              <Avatar className="size-8 border">
                {image ? <AvatarImage alt="" src={image} /> : null}
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </button>
          }
        />

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="font-medium text-sm">{name ?? "Your account"}</span>
            <span className="truncate font-normal text-muted-foreground text-xs">{email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem render={<Link href="/dashboard/profile" />}>
            <UserRoundIcon className="size-4" />
            CV Builder
          </DropdownMenuItem>
          <DropdownMenuItem render={<Link href="/dashboard/settings" />}>
            <SettingsIcon className="size-4" />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            // Base UI items take `onClick` rather than Radix's `onSelect`, and
            // `closeOnClick={false}` is how the menu is kept mounted until the
            // navigation is under way (Radix needed `event.preventDefault()`).
            closeOnClick={false}
            onClick={() => signOutForm.current?.requestSubmit()}
            variant="destructive"
          >
            <LogOutIcon className="size-4" />
            Sign out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
