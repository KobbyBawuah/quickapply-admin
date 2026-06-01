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
} from "lucide-react";
import { useState } from "react";

const navItems = [
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

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const qc = useQueryClient();
  const [campaignsOpen, setCampaignsOpen] = useState(location.startsWith("/campaigns"));
  const [aiOpen, setAiOpen] = useState(location.startsWith("/ai"));

  function handleLogout() {
    clearToken();
    qc.clear();
    window.location.href = "/login";
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 flex flex-col bg-sidebar border-r border-sidebar-border">
        {/* Logo */}
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-sidebar-primary flex items-center justify-center">
              <Zap className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-white leading-tight">QuickApply</div>
              <div className="text-[10px] text-sidebar-foreground leading-tight">Admin Console</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
          {navItems.map((item) => {
            if (item.children) {
              const isAi = item.key === "ai";
              const isOpen = isAi ? aiOpen : campaignsOpen;
              const toggleOpen = isAi ? () => setAiOpen((o) => !o) : () => setCampaignsOpen((o) => !o);
              const isGroupActive = isAi ? location.startsWith("/ai") : location.startsWith("/campaigns");

              return (
                <div key={item.label}>
                  <button
                    onClick={toggleOpen}
                    className={cn(
                      "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors",
                      isGroupActive
                        ? "text-white bg-sidebar-accent"
                        : "text-sidebar-foreground hover:text-white hover:bg-sidebar-accent"
                    )}
                  >
                    <item.icon className="w-4 h-4 flex-shrink-0" />
                    <span className="flex-1 text-left">{item.label}</span>
                    <ChevronDown
                      className={cn("w-3.5 h-3.5 transition-transform", isOpen && "rotate-180")}
                    />
                  </button>
                  {isOpen && (
                    <div className="ml-4 mt-0.5 space-y-0.5 pl-2 border-l border-sidebar-border">
                      {item.children.map((child) => {
                        const active = location === child.href;
                        return (
                          <Link
                            key={child.href}
                            href={child.href}
                            className={cn(
                              "flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                              active
                                ? "text-white bg-sidebar-primary/20"
                                : "text-sidebar-foreground hover:text-white hover:bg-sidebar-accent"
                            )}
                          >
                            <child.icon className="w-3.5 h-3.5 flex-shrink-0" />
                            {child.label}
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
              <Link
                key={item.href}
                href={item.href!}
                className={cn(
                  "flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] font-medium transition-colors",
                  active
                    ? "text-white bg-sidebar-primary/20 border border-sidebar-primary/30"
                    : "text-sidebar-foreground hover:text-white hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="w-4 h-4 flex-shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-sidebar-border">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-md text-[13px] text-sidebar-foreground hover:text-white hover:bg-sidebar-accent transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-background">{children}</main>
    </div>
  );
}
