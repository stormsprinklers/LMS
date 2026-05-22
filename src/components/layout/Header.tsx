import { Bell, Search, User } from "lucide-react";
import { auth } from "@/auth";
import { SignOutButton } from "./SignOutButton";

export async function Header({ title }: { title?: string }) {
  const session = await auth();
  const name = session?.user?.name ?? "Team Member";
  const role = (session?.user as { role?: string })?.role ?? "Employee";

  return (
    <header className="flex h-16 items-center justify-between border-b border-storm-light-blue/60 bg-white px-6">
      {title ? (
        <p className="text-sm font-medium text-storm-navy/60 lg:hidden">
          {title}
        </p>
      ) : (
        <div />
      )}

      <div className="flex items-center gap-3">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-storm-navy/60 transition-colors hover:bg-storm-light-grey hover:text-storm-navy"
          aria-label="Search"
        >
          <Search className="h-5 w-5" />
        </button>
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-storm-navy/60 transition-colors hover:bg-storm-light-grey hover:text-storm-navy"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
        </button>
        <div className="ml-2 flex items-center gap-2 rounded-lg border border-storm-light-blue/60 bg-storm-light-grey/50 px-3 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-storm-medium-blue text-white">
            <User className="h-4 w-4" />
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-storm-navy">{name}</p>
            <p className="text-xs text-storm-navy/60 capitalize">
              {role.toLowerCase()}
            </p>
            <SignOutButton />
          </div>
        </div>
      </div>
    </header>
  );
}
