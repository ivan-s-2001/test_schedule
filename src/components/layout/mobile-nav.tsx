"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("nav");

  function isActive(href: string) {
    const segment = `/${href.split("/")[1]}`;
    return pathname.startsWith(segment);
  }

  const itemClass = (active: boolean) =>
    cn(
      "flex min-h-[30px] items-center gap-2 rounded-sm px-3 py-1.5 text-sm font-medium text-[#4e5c6e] transition-colors",
      active
        ? "bg-[#cdd8e5] text-[#111319]"
        : "hover:bg-[#dee5ed] hover:text-[#111319]"
    );

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden">
          <Menu className="size-5" />
          <span className="sr-only">{t("schedule")}</span>
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        className="w-72 border-[#dae1e9] bg-[#eef2f6] p-0"
      >
        <SheetHeader className="border-b border-[#dae1e9] px-4 py-3">
          <SheetTitle className="flex items-center gap-2 text-base font-semibold text-[#111319]">
            <CalendarDays className="size-5 text-[#4e5c6e]" />
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
                {t(item.key)}
              </Link>
            );
          })}

          <Link
            href="/ai/chat"
            onClick={() => setOpen(false)}
            className={itemClass(pathname.startsWith("/ai"))}
          >
            <Sparkles className="size-4" />
            {t("ai")}
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
