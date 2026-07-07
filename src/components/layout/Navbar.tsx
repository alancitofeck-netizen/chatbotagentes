import { ThemeToggle } from "@/lib/theme/ThemeToggle";
import { MobileNav } from "./MobileNav";
import { UserMenu } from "./UserMenu";

interface NavbarProps {
  workspaceName: string;
  userName: string;
  userEmail: string;
}

export function Navbar({ workspaceName, userName, userEmail }: NavbarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-border-default bg-surface-1 px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <MobileNav />
        <span className="truncate text-sm font-medium text-foreground">{workspaceName}</span>
      </div>
      <div className="flex items-center gap-2">
        <ThemeToggle />
        <UserMenu name={userName} email={userEmail} />
      </div>
    </header>
  );
}
