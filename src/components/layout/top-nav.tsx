"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  Clock,
  Users,
  Building2,
  MessageSquare,
  BarChart3,
  Settings,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { UserMenu } from "./user-menu";
import { MobileNav } from "./mobile-nav";

const navItems = [
  { key: "schedule", icon: CalendarDays, href: "/schedule/flexible", label: "Schichtplaene" },
  { key: "time", icon: Clock, href: "/time", label: "Zeiterfassung" },
  { key: "employees", icon: Users, href: "/employees", label: "Mitarbeiter" },
  { key: "divisions", icon: Building2, href: "/divisions", label: "Arbeitsbereiche" },
  { key: "portal", icon: MessageSquare, href: "/portal/inbox", label: "Portal" },
  { key: "reporting", icon: BarChart3, href: "/reporting", label: "Auswertung" },
  { key: "settings", icon: Settings, href: "/settings", label: "Einstellungen" },
] as const;

export { navItems };

export function TopNav() {
  const pathname = usePathname();

  function isActive(href: string) {
    const segment = "/" + href.split("/")[1];
    return pathname.startsWith(segment);
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-white dark:bg-slate-900 dark:border-slate-800">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-2 px-4">
        {/* Mobile hamburger */}
        <MobileNav />

        {/* Logo */}
        <Link
          href="/schedule/flexible"
          className="mr-4 flex items-center gap-2 font-bold text-indigo-600 dark:text-indigo-400"
        >
          <CalendarDays className="size-5" />
          <span className="hidden sm:inline">Schichtplaner</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex md:items-center md:gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Icon className="size-4" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          {/* AI button */}
          <Link
            href="/ai/chat"
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              pathname.startsWith("/ai")
                ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            )}
          >
            <Sparkles className="size-4" />
            <span className="hidden lg:inline">KI</span>
          </Link>

          <UserMenu />
        </div>
      </div>
    </header>
  );
}
