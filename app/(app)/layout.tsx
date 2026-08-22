import type { ReactNode } from "react";

import { initialsOf, requireUser } from "@/app/lib/current-user";
import { Sidebar, SidebarProvider } from "./_components/sidebar";
import { Topbar } from "./_components/topbar";

export default async function AppLayout({ children }: { readonly children: ReactNode }) {
  const user = await requireUser();

  return (
    <SidebarProvider>
      <div className="flex h-dvh overflow-hidden">
        <Sidebar initials={initialsOf(user)} name={user.name ?? user.email} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar
            email={user.email}
            image={user.image}
            initials={initialsOf(user)}
            name={user.name}
          />
          <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">{children}</div>
        </div>
      </div>
    </SidebarProvider>
  );
}
