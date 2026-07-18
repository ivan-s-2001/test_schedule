"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Table2 } from "lucide-react";
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
  const now = new Date();
  const effectiveKW =
    kw ?? `01-${now.getFullYear()}`;
  const effectiveMonth =
    month ?? kwToMonth(effectiveKW);
  const monthActive = pathname.includes("/schedule/month");

  const views = [
    {
      key: "week",
      label: "Неделя",
      icon: Table2,
      href: `/schedule/employee/${effectiveKW}`,
      active: !monthActive,
    },
    {
      key: "month",
      label: "Месяц",
      icon: CalendarDays,
      href: `/schedule/month/${effectiveMonth}`,
      active: monthActive,
    },
  ];

  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/30 p-1">
      {views.map((view) => {
        const Icon = view.icon;

        return (
          <Link
            key={view.key}
            href={view.href}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-all",
              view.active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-background/50 hover:text-foreground"
            )}
          >
            <Icon className="size-3.5" />
            <span>{view.label}</span>
          </Link>
        );
      })}
    </div>
  );
}
