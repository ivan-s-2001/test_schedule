"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
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
import { ConnectionStatus } from "./connection-status";

const navItems = [
  { key: "schedule", icon: CalendarDays, href: "/schedule/flexible", label: "Графики смен" },
  { key: "time", icon: Clock, href: "/time", label: "Учёт времени" },
  { key: "employees", icon: Users, href: "/employees", label: "Сотрудники" },
  { key: "divisions", icon: Building2, href: "/divisions", label: "Подразделения" },
  { key: "portal", icon: MessageSquare, href: "/portal/inbox", label: "Портал" },
  { key: "reporting", icon: BarChart3, href: "/reporting", label: "Отчёты" },
  { key: "settings", icon: Settings, href: "/settings", label: "Настройки" },
] as const;

export { navItems };

export function TopNav() {
  const pathname = usePathname();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["messages", "unread-count"],
    queryFn: () => fetch("/api/messages/unread-count").then((r) => r.json()),
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.count ?? 0;

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
          <span className="hidden sm:inline">График смен</span>
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
                  "relative flex items-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                )}
              >
                <Icon className="size-4" />
                <span className="hidden lg:inline">{item.label}</span>
                {item.key === "portal" && unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
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
            <span className="hidden lg:inline">ИИ</span>
          </Link>

          <ConnectionStatus />
          <UserMenu />
        </div>
      </div>
    </header>
  );
}
