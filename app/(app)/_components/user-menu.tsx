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
        <DropdownMenuTrigger asChild>
          <button
            aria-label="Account menu"
            className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            type="button"
          >
            <Avatar className="size-8 border">
              {image ? <AvatarImage alt="" src={image} /> : null}
              <AvatarFallback>{initials}</AvatarFallback>
            </Avatar>
          </button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="font-medium text-sm">{name ?? "Your account"}</span>
            <span className="truncate font-normal text-muted-foreground text-xs">{email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild>
            <Link href="/profile">
              <UserRoundIcon className="size-4" />
              CV Builder
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem asChild>
            <Link href="/settings">
              <SettingsIcon className="size-4" />
              Settings
            </Link>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onSelect={(event) => {
              // Keep the menu mounted until the navigation is under way.
              event.preventDefault();
              signOutForm.current?.requestSubmit();
            }}
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
