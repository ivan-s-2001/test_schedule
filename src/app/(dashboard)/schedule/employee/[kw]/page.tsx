import { redirect } from "next/navigation";
import { EmployeeGridWrapper } from "@/components/schedule/employee-grid-wrapper";
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">График службы заботы</h1>
          <p className="text-sm text-muted-foreground">
            Недельная таблица сотрудников и смен из фиксированного пула
          </p>
        </div>
        <ViewSwitcher kw={kw} />
      </div>

      <WeekNav
        weekNumber={weekNumber}
        year={year}
        baseUrl="/schedule/employee"
      />

      <EmployeeGridWrapper
        weekNumber={weekNumber}
        year={year}
        weekDateStrings={weekDateStrings}
      />
    </div>
  );
}
