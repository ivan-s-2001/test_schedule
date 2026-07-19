"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Layers3, Table2 } from "lucide-react";
import { useCurrentMember } from "@/lib/hooks/use-current-member";
import { formatKW, getCurrentKW } from "@/lib/utils/calendar";
import { cn } from "@/lib/utils";

interface ViewSwitcherProps {
  kw?: string;
  month?: string;
}

function kwToMonth(kw: string): string {
  const match = kw.match(/^(\d{1,2})-(\d{4})$/);
  if (!match) {
    const now = new Date();
    return `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
  }

  const weekNumber = Number.parseInt(match[1], 10);
  const year = Number.parseInt(match[2], 10);
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);
  const thursday = new Date(firstMonday);
  thursday.setDate(firstMonday.getDate() + (weekNumber - 1) * 7 + 3);

  return `${String(thursday.getMonth() + 1).padStart(2, "0")}-${thursday.getFullYear()}`;
}

export function ViewSwitcher({ kw, month }: ViewSwitcherProps) {
  const pathname = usePathname();
  const { data: currentMember } = useCurrentMember();
  const now = new Date();
  const currentKW = getCurrentKW();
  const effectiveKW = kw ?? formatKW(currentKW.weekNumber, currentKW.year);
  const effectiveMonth =
    month ??
    (kw
      ? kwToMonth(effectiveKW)
      : `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`);
  const monthActive = pathname.includes("/schedule/month");
  const poolActive = pathname.includes("/schedule/pool");
  const canManagePool =
    currentMember?.role === "OWNER" ||
    currentMember?.role === "ADMIN" ||
    currentMember?.role === "MANAGER";

  const views = [
    {
      key: "week",
      label: "Неделя",
      icon: Table2,
      href: `/schedule/employee/${effectiveKW}`,
      active: !monthActive && !poolActive,
      visible: true,
    },
    {
      key: "month",
      label: "Месяц",
      icon: CalendarDays,
      href: `/schedule/month/${effectiveMonth}`,
      active: monthActive,
      visible: true,
    },
    {
      key: "pool",
      label: "Пул смен",
      icon: Layers3,
      href: "/schedule/pool",
      active: poolActive,
      visible: canManagePool,
    },
  ];

  return (
    <nav
      aria-label="Вид графика"
      className="inline-flex items-center rounded-md border border-border bg-[var(--outline-input-background)] p-0.5"
    >
      {views
        .filter((view) => view.visible)
        .map((view) => {
          const Icon = view.icon;

          return (
            <Link
              key={view.key}
              href={view.href}
              aria-current={view.active ? "page" : undefined}
              className={cn(
                "flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors",
                view.active
                  ? "bg-background text-[var(--accent-strong)] shadow-[0_0_0_1px_var(--accent-border)]"
                  : "text-muted-foreground hover:bg-[var(--accent-subtle)] hover:text-foreground"
              )}
            >
              <Icon className="size-3.5" />
              <span>{view.label}</span>
            </Link>
          );
        })}
    </nav>
  );
}
