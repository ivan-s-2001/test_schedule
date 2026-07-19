"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { CalendarIcon } from "@/components/icons/outline-icons";
import { cn } from "@/lib/utils";
import { MobileNav } from "./mobile-nav";
import { UserMenu } from "./user-menu";
import { ConnectionStatus } from "./connection-status";
import {
  isNavigationItemActive,
  navigationGroups,
  utilityNavigationItems,
  type NavigationItem,
} from "./navigation";

function SidebarLink({
  item,
  pathname,
  unreadCount = 0,
}: {
  item: NavigationItem;
  pathname: string;
  unreadCount?: number;
}) {
  const Icon = item.icon;
  const active = isNavigationItemActive(pathname, item.href);

  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center gap-2.5 rounded-md px-2.5 text-[14px] font-medium transition-colors",
        active
          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
          : "text-sidebar-foreground hover:bg-[var(--accent-subtle)] hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon
        className={cn(
          "size-[18px] shrink-0 transition-colors",
          active
            ? "text-[var(--accent-strong)]"
            : "text-sidebar-foreground/80 group-hover:text-sidebar-accent-foreground"
        )}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.key === "portal" && unreadCount > 0 && (
        <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
          {unreadCount > 99 ? "99+" : unreadCount}
        </span>
      )}
    </Link>
  );
}

export function TopNav() {
  const pathname = usePathname();

  const { data: unreadData } = useQuery<{ count: number }>({
    queryKey: ["messages", "unread-count"],
    queryFn: () => fetch("/api/messages/unread-count").then((response) => response.json()),
    refetchInterval: 30000,
  });

  const unreadCount = unreadData?.count ?? 0;

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="flex h-14 items-center px-3">
          <Link
            href="/schedule/employee"
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-1.5 py-1.5 hover:bg-[var(--accent-subtle)]"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary text-primary-foreground shadow-[inset_0_0_0_1px_rgb(255_255_255/18%)]">
              <CalendarIcon className="size-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[14px] font-semibold leading-4 text-sidebar-accent-foreground">
                QuickTickets
              </span>
              <span className="block truncate text-[11px] leading-4 text-sidebar-foreground">
                Планирование смен
              </span>
            </span>
          </Link>
        </div>

        <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 pb-3 pt-2">
          {navigationGroups.map((group, groupIndex) => (
            <section
              key={group.label}
              className={cn(groupIndex > 0 && "mt-5")}
              aria-label={group.label}
            >
              <div className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/65">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => (
                  <SidebarLink
                    key={item.key}
                    item={item}
                    pathname={pathname}
                    unreadCount={unreadCount}
                  />
                ))}
              </div>
            </section>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <div className="space-y-0.5 pb-2">
            {utilityNavigationItems.map((item) => (
              <SidebarLink
                key={item.key}
                item={item}
                pathname={pathname}
              />
            ))}
          </div>
          <div className="flex items-center gap-1 border-t border-sidebar-border pt-2">
            <UserMenu className="min-w-0 flex-1 justify-start" />
            <ConnectionStatus compact />
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-40 flex h-[52px] items-center border-b border-border bg-background/96 px-2 backdrop-blur lg:hidden">
        <MobileNav />
        <Link
          href="/schedule/employee"
          className="ml-1 flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1"
        >
          <span className="grid size-7 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground">
            <CalendarIcon className="size-4" />
          </span>
          <span className="truncate text-sm font-semibold">QuickTickets</span>
        </Link>
        <div className="ml-auto flex items-center gap-0.5">
          <ConnectionStatus compact />
          <UserMenu showName={false} />
        </div>
      </header>
    </>
  );
}
