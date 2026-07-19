"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("schedule.views");
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
      key: "week" as const,
      icon: Table2,
      href: `/schedule/employee/${effectiveKW}`,
      active: !monthActive && !poolActive,
      visible: true,
    },
    {
      key: "month" as const,
      icon: CalendarDays,
      href: `/schedule/month/${effectiveMonth}`,
      active: monthActive,
      visible: true,
    },
    {
      key: "pool" as const,
      icon: Layers3,
      href: "/schedule/pool",
      active: poolActive,
      visible: canManagePool,
    },
  ];

  return (
    <nav className="flex items-end gap-6 border-b border-[#dae1e9]">
      {views
        .filter((view) => view.visible)
        .map((view) => {
          const Icon = view.icon;

          return (
            <Link
              key={view.key}
              href={view.href}
              className={cn(
                "relative flex items-center gap-1.5 px-0.5 py-2 text-sm font-medium text-[#66778f] transition-colors hover:text-[#394351]",
                view.active &&
                  "text-[#394351] after:absolute after:inset-x-0 after:bottom-0 after:h-[3px] after:rounded-t after:bg-[#394351]"
              )}
            >
              <Icon className="size-3.5" />
              <span>{t(view.key)}</span>
            </Link>
          );
        })}
    </nav>
  );
}
