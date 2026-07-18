import { redirect } from "next/navigation";
import {
  parseKW,
  getCurrentKW,
  formatKW,
  getWeekDates,
} from "@/lib/utils/calendar";
import { WeekNav } from "@/components/schedule/week-nav";
import { EmployeeGridWrapper } from "@/components/schedule/employee-grid-wrapper";

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
      <div>
        <h1 className="text-2xl font-bold">График службы заботы</h1>
        <p className="text-sm text-muted-foreground">
          Недельная таблица сотрудников и смен из фиксированного пула
        </p>
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
