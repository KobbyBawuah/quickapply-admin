import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { clearToken } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard,
  Users,
  Mail,
  FileText,
  BarChart2,
  Settings,
  LogOut,
  ChevronDown,
  Clock,
  Newspaper,
  History,
  Zap,
  Sparkles,
  ListChecks,
  BookCheck,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

type NavChild = {
  href: string;
  label: string;
  icon: React.ElementType;
};

type NavItem =
  | {
      href: string;
      label: string;
      icon: React.ElementType;
      children?: never;
      key?: never;
    }
  | {
      label: string;
      icon: React.ElementType;
      key: "campaigns" | "ai";
      children: NavChild[];
      href?: never;
    };

const navItems: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  {
    label: "Campaigns",
    icon: Mail,
    key: "campaigns",
    children: [
      { href: "/campaigns/inactive", label: "Inactive Users", icon: Clock },
      { href: "/campaigns/newsletter", label: "Newsletter", icon: Newspaper },
      { href: "/campaigns/runs", label: "Run History", icon: History },
    ],
  },
  {
    label: "AI Content",
    icon: Sparkles,
    key: "ai",
    children: [
      { href: "/ai/generator", label: "AI Generator", icon: Zap },
      { href: "/ai/queue", label: "Approval Queue", icon: ListChecks },
      { href: "/ai/approved", label: "Approved Templates", icon: BookCheck },
    ],
  },
  { href: "/templates", label: "Templates", icon: FileText },
  { href: "/logs", label: "Email Logs", icon: BarChart2 },
  { href: "/settings", label: "Settings", icon: Settings },
];

function Sidebar({
  onNavigate,
}: {
  onNavigate?: () => void;
}) {
  const [location] = useLocation();
  const qc = useQueryClient();
  const [campaignsOpen, setCampaignsOpen] = useState(
    location.startsWith("/campaigns")
  );
  const [aiOpen, setAiOpen] = useState(location.startsWith("/ai"));

  function handleLogout() {
    clearToken();
    qc.clear();
    window.location.href = "/login";
  }

  return (
    <aside className="w-64 lg:w-56 h-full flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
      <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-7 h-7 rounded-md bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>

          <div className="min-w-0">
            <div className="text-[13px] font-semibold text-white leading-tight truncate">
              QuickApply
            </div>
            <div className="text-[10px] text-sidebar-foreground leading-tight truncate">
              Admin Console
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {navItems.map((item) => {
          if ("children" in item && item.children) {
            const isAi = item.key === "ai";
            const isOpen = isAi ? aiOpen : campaignsOpen;
            const toggleOpen = isAi
              ? () => setAiOpen((o) => !o)
              : () => setCampaignsOpen((o) => !o);

            const isGroupActive = isAi
              ? location.startsWith("/ai")
              : location.startsWith("/campaigns");

            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={toggleOpen}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors",
                    isGroupActive
                      ? "text-white bg-sidebar-accent"
                      : "text-sidebar-foreground hover:text-white hover:bg-sidebar-accent"
                  )}
                >
                  <item.icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1 text-left truncate">
                    {item.label}
                  </span>
                  <ChevronDown
                    className={cn(
                      "w-3.5 h-3.5 transition-transform flex-shrink-0",
                      isOpen && "rotate-180"
                    )}
                  />
                </button>

                {isOpen && (
                  <div className="ml-4 mt-0.5 space-y-0.5 pl-2 border-l border-sidebar-border">
                    {item.children.map((child) => {
                      const active = location === child.href;

                      return (
                        <Link key={child.href} href={child.href}>
                          <a
                            onClick={onNavigate}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                              active
                                ? "text-white bg-sidebar-primary/20"
                                : "text-sidebar-foreground hover:text-white hover:bg-sidebar-accent"
                            )}
                          >
                            <child.icon className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="truncate">{child.label}</span>
                          </a>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active = location === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <a
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors",
                  active
                    ? "text-white bg-sidebar-primary/20 border border-sidebar-primary/30"
                    : "text-sidebar-foreground hover:text-white hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </a>
            </Link>
          );
        })}
      </nav>

      <div className="p-2 border-t border-sidebar-border">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-sidebar-foreground hover:text-white hover:bg-sidebar-accent transition-colors"
        >
          <LogOut className="w-4 h-4 flex-shrink-0" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <header className="lg:hidden sticky top-0 z-40 h-14 bg-sidebar border-b border-sidebar-border px-4 flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-md bg-sidebar-primary flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-white" />
          </div>

          <div className="min-w-0">
            <div className="text-sm font-semibold text-white leading-tight truncate">
              QuickApply
            </div>
            <div className="text-[10px] text-sidebar-foreground leading-tight truncate">
              Admin Console
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="p-2 rounded-md text-white hover:bg-sidebar-accent"
          aria-label="Open menu"
        >
          <Menu className="w-5 h-5" />
        </button>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close sidebar overlay"
            className="absolute inset-0 bg-black/60 w-full h-full"
            onClick={() => setMobileOpen(false)}
          />

          <div className="absolute inset-y-0 left-0 w-64 max-w-[85vw]">
            <Sidebar onNavigate={() => setMobileOpen(false)} />
          </div>

          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute top-3 right-3 p-2 rounded-md bg-white text-slate-900 shadow"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="flex min-h-[calc(100vh-56px)] lg:min-h-screen">
        <div className="hidden lg:block fixed inset-y-0 left-0 z-30">
          <Sidebar />
        </div>

        <main className="flex-1 min-w-0 lg:pl-56">
          <div className="min-h-[calc(100vh-56px)] lg:min-h-screen overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}