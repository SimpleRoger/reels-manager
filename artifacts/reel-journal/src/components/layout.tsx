import { Link, useLocation } from "wouter";
import {
  Film,
  BookOpen,
  Search,
  ListChecks,
  Settings,
  UserCircle2,
  MessageSquare,
  CalendarDays,
  Music,
  Clapperboard,
  Dumbbell,
} from "lucide-react";

const navigation = [
  { name: "Calendar", shortName: "Plan", href: "/calendar", icon: CalendarDays },
  { name: "Reels Log", shortName: "Log", href: "/reels", icon: Film },
  { name: "Profile", shortName: "Profile", href: "/profile", icon: UserCircle2 },
  { name: "Playbook", shortName: "Playbook", href: "/playbook", icon: BookOpen },
  { name: "Viral Finder", shortName: "Viral", href: "/viral-finder", icon: Search },
  { name: "Remake List", shortName: "Remakes", href: "/remake-list", icon: ListChecks },
  { name: "DM Importer", shortName: "DMs", href: "/dm-importer", icon: MessageSquare },
];

const remakeCategories = [
  { name: "Music",   tag: "Music",   icon: Music },
  { name: "Content", tag: "Content", icon: Clapperboard },
  { name: "Health",  tag: "Health",  icon: Dumbbell },
];

const TAG_COLORS: Record<string, string> = {
  music:   "text-purple-400",
  content: "text-amber-400",
  health:  "text-emerald-400",
};

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  function isActive(href: string) {
    return location === href || (href !== "/" && location.startsWith(href));
  }

  const isRemakeActive = isActive("/remake-list");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex w-64 border-r border-sidebar-border bg-sidebar flex-col shrink-0">
        <div className="p-6">
          <h1 className="text-xl font-bold text-sidebar-primary tracking-tight font-mono">
            REEL<span className="text-sidebar-foreground">JOURNAL</span>
          </h1>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
          {navigation.map((item) => (
            <div key={item.name}>
              <Link
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive(item.href)
                    ? "bg-sidebar-accent text-sidebar-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-primary"
                }`}
              >
                <item.icon className="h-4 w-4" />
                {item.name}
              </Link>

              {/* Category sub-links under Remake List */}
              {item.href === "/remake-list" && isRemakeActive && (
                <div className="ml-7 mt-0.5 mb-1 space-y-0.5">
                  {remakeCategories.map((cat) => {
                    const catActive = location === `/remake-list?tag=${cat.tag.toLowerCase()}` ||
                      (typeof window !== "undefined" &&
                        window.location.search === `?tag=${cat.tag.toLowerCase()}`);
                    return (
                      <Link
                        key={cat.tag}
                        href={`/remake-list?tag=${cat.tag.toLowerCase()}`}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                          catActive
                            ? "bg-sidebar-accent/70 text-sidebar-primary"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/30 hover:text-sidebar-foreground"
                        }`}
                      >
                        <cat.icon className={`h-3 w-3 ${TAG_COLORS[cat.tag.toLowerCase()] ?? ""}`} />
                        {cat.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border">
          <Link
            href="/settings"
            className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              isActive("/settings")
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
      <main className="flex-1 overflow-y-auto bg-background flex flex-col min-w-0">
        {/* Mobile top header */}
        <div className="md:hidden sticky top-0 z-20 flex items-center justify-between px-4 h-12 border-b border-sidebar-border bg-sidebar shrink-0">
          <h1 className="text-lg font-bold text-sidebar-primary tracking-tight font-mono">
            REEL<span className="text-sidebar-foreground">JOURNAL</span>
          </h1>
          <Link
            href="/settings"
            className={`p-1.5 rounded-md transition-colors ${
              isActive("/settings")
                ? "text-sidebar-primary"
                : "text-sidebar-foreground hover:text-sidebar-primary"
            }`}
          >
            <Settings className="h-5 w-5" />
          </Link>
        </div>

        {/* Page content */}
        <div className="p-4 md:p-6 w-full pb-24 md:pb-6">
          {children}
        </div>
      </main>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 bg-sidebar border-t border-sidebar-border flex">
        {navigation.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 min-w-0"
            >
              <item.icon
                className={`h-5 w-5 shrink-0 ${active ? "text-sidebar-primary" : "text-sidebar-foreground"}`}
              />
              <span
                className={`text-[9px] font-medium truncate w-full text-center leading-none ${
                  active ? "text-sidebar-primary" : "text-sidebar-foreground"
                }`}
              >
                {item.shortName}
              </span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
