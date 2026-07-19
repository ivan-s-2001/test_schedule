"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, CalendarDays, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { navItems } from "./top-nav";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  function isActive(href: string) {
    const segment = "/" + href.split("/")[1];
    return pathname.startsWith(segment);
  }

  const itemClass = (active: boolean) =>
    cn(
      "flex min-h-8 items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
      active
        ? "bg-sidebar-primary text-sidebar-primary-foreground"
        : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
    );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="size-5" />
          <span className="sr-only">Навигация</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-sidebar-border bg-sidebar p-0">
        <SheetHeader className="border-b border-sidebar-border px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold text-sidebar-primary-foreground">
            <CalendarDays className="size-5 text-sidebar-foreground" />
            QuickTickets
          </SheetTitle>
        </SheetHeader>
        <nav className="flex flex-col gap-0.5 p-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                onClick={() => setOpen(false)}
                className={itemClass(active)}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
          <Link
            href="/ai/chat"
            onClick={() => setOpen(false)}
            className={itemClass(pathname.startsWith("/ai"))}
          >
            <Sparkles className="size-4" />
            ИИ-ассистент
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}