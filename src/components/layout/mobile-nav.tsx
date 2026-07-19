"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, MenuIcon } from "@/components/icons/outline-icons";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  isNavigationItemActive,
  navigationGroups,
  utilityNavigationItems,
} from "./navigation";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Открыть навигацию">
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent
        side="left"
        className="flex w-[min(86vw,300px)] flex-col border-sidebar-border bg-sidebar p-0"
      >
        <SheetHeader className="border-b border-sidebar-border px-3 py-3 text-left">
          <SheetTitle className="flex items-center gap-2.5 text-sm font-semibold text-sidebar-accent-foreground">
            <span className="grid size-8 place-items-center rounded-lg bg-primary text-primary-foreground">
              <CalendarIcon className="size-[18px]" />
            </span>
            <span>
              <span className="block leading-4">QuickTickets</span>
              <span className="block text-[11px] font-normal leading-4 text-sidebar-foreground">
                Планирование смен
              </span>
            </span>
          </SheetTitle>
        </SheetHeader>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 py-3">
          {navigationGroups.map((group, groupIndex) => (
            <section key={group.label} className={cn(groupIndex > 0 && "mt-5")}>
              <div className="mb-1 px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-sidebar-foreground/65">
                {group.label}
              </div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isNavigationItemActive(pathname, item.href);

                  return (
                    <Link
                      key={item.key}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium",
                        active
                          ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                          : "text-sidebar-foreground hover:bg-[var(--accent-subtle)] hover:text-sidebar-accent-foreground"
                      )}
                    >
                      <Icon className="size-[18px]" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          {utilityNavigationItems.map((item) => {
            const Icon = item.icon;
            const active = isNavigationItemActive(pathname, item.href);

            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex h-10 items-center gap-2.5 rounded-md px-2.5 text-sm font-medium",
                  active
                    ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                    : "text-sidebar-foreground hover:bg-[var(--accent-subtle)] hover:text-sidebar-accent-foreground"
                )}
              >
                <Icon className="size-[18px]" />
                {item.label}
              </Link>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}
