import { redirect } from "next/navigation";
import { EmployeeGridWrapper } from "@/components/schedule/employee-grid-wrapper";
import { ShiftLegend } from "@/components/schedule/shift-legend";
import { ViewSwitcher } from "@/components/schedule/view-switcher";
import { WeekNav } from "@/components/schedule/week-nav";
import {
  formatKW,
  getCurrentKW,
  getWeekDates,
  parseKW,
} from "@/lib/utils/calendar";

interface EmployeeKWPageProps {
  params: Promise<{ kw: string }>;
}

export default async function EmployeeKWPage({ params }: EmployeeKWPageProps) {
  const { kw } = await params;
  const parsed = parseKW(kw);

  if (!parsed) {
    const current = getCurrentKW();
    redirect(`/schedule/employee/${formatKW(current.weekNumber, current.year)}`);
  }

  const { weekNumber, year } = parsed;
  const weekDates = getWeekDates(weekNumber, year);
  const weekDateStrings = weekDates.map((date) => date.toISOString());

  return (
    <div className="schedule-equal-day-columns space-y-5">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1>График службы заботы</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Недельное планирование сотрудников и смен
          </p>
        </div>
        <div className="shrink-0">
          <ViewSwitcher kw={kw} />
        </div>
      </header>

      <section className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border p-3 sm:p-4">
          <WeekNav
            weekNumber={weekNumber}
            year={year}
            baseUrl="/schedule/employee"
          />
        </div>

        <div className="border-b border-border bg-[var(--outline-smoke-light)] px-3 py-2.5 dark:bg-[var(--outline-smoke)] sm:px-4">
          <ShiftLegend />
        </div>

        <div className="p-2 sm:p-3">
          <EmployeeGridWrapper
            weekNumber={weekNumber}
            year={year}
            weekDateStrings={weekDateStrings}
          />
        </div>
      </section>
    </div>
  );
}
