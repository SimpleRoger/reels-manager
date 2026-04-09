import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Film,
  BookOpen,
  Search,
  ListChecks,
  Settings,
  UserCircle2,
} from "lucide-react";

const navigation = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Reels Log", href: "/reels", icon: Film },
  { name: "Profile", href: "/profile", icon: UserCircle2 },
  { name: "Playbook", href: "/playbook", icon: BookOpen },
  { name: "Viral Finder", href: "/viral-finder", icon: Search },
  { name: "Remake List", href: "/remake-list", icon: ListChecks },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-sidebar-border bg-sidebar flex flex-col">
        <div className="p-6">
          <h1 className="text-xl font-bold text-sidebar-primary tracking-tight font-mono">
            REEL<span className="text-sidebar-foreground">JOURNAL</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => {
            const isActive = location === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>
            );
          })}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              location === "/settings"
                ? "bg-sidebar-accent text-sidebar-primary"
                : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary"
            }`}
          >
            <Settings className="h-4 w-4" />
            Settings
          </Link>
        </div>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-background">
        <div className="p-8 max-w-7xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
