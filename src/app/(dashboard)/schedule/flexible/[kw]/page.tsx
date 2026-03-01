import { redirect } from "next/navigation";
import {
  parseKW,
  getCurrentKW,
  formatKW,
  getWeekDates,
} from "@/lib/utils/calendar";
import { WeekNav } from "@/components/schedule/week-nav";
import { ScheduleGridWrapper } from "@/components/schedule/schedule-grid-wrapper";

interface ScheduleKWPageProps {
  params: Promise<{ kw: string }>;
}

export default async function ScheduleKWPage({ params }: ScheduleKWPageProps) {
  const { kw } = await params;
  const parsed = parseKW(kw);

  if (!parsed) {
    // Invalid KW format, redirect to current week
    const current = getCurrentKW();
    redirect(`/schedule/flexible/${formatKW(current.weekNumber, current.year)}`);
  }

  const { weekNumber, year } = parsed;
  const weekDates = getWeekDates(weekNumber, year);

  // Serialize dates as ISO strings for the client component
  const weekDateStrings = weekDates.map((d) => d.toISOString());

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <WeekNav weekNumber={weekNumber} year={year} />

      {/* 7-Column Schedule Grid with Shifts */}
      <ScheduleGridWrapper
        weekNumber={weekNumber}
        year={year}
        weekDateStrings={weekDateStrings}
      />
    </div>
  );
}
