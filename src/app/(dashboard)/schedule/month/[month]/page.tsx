import { getISOWeek, getISOWeekYear } from "date-fns";
import { redirect } from "next/navigation";
import { MonthGridWrapper } from "@/components/schedule/month-grid-wrapper";
import { ShiftLegend } from "@/components/schedule/shift-legend";
import { ViewSwitcher } from "@/components/schedule/view-switcher";
import { formatKW } from "@/lib/utils/calendar";

interface MonthPageProps {
  params: Promise<{ month: string }>;
}

function parseMonth(value: string): { month: number; year: number } | null {
  const match = value.match(/^(\d{1,2})-(\d{4})$/);
  if (!match) return null;

  const month = Number.parseInt(match[1], 10);
  const year = Number.parseInt(match[2], 10);
  if (month < 1 || month > 12) return null;

  return { month, year };
}

export default async function MonthViewPage({ params }: MonthPageProps) {
  const { month: monthParam } = await params;
  const parsed = parseMonth(monthParam);

  if (!parsed) {
    const now = new Date();
    redirect(
      `/schedule/month/${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`
    );
  }

  const { month, year } = parsed;
  const firstDay = new Date(year, month - 1, 1);
  const kw = formatKW(getISOWeek(firstDay), getISOWeekYear(firstDay));

  return (
    <div className="schedule-equal-day-columns space-y-5">
      <header className="space-y-3">
        <div>
          <h1 className="text-[26px] font-medium leading-tight text-[#111319]">
            График службы заботы
          </h1>
          <p className="mt-1 text-sm text-[#66778f]">Месячная таблица сотрудников и смен</p>
        </div>
        <ViewSwitcher kw={kw} month={monthParam} />
      </header>

      <ShiftLegend />
      <MonthGridWrapper month={month} year={year} />
    </div>
  );
}
