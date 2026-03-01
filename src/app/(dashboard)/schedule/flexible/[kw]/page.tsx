import { redirect } from "next/navigation";
import {
  parseKW,
  getCurrentKW,
  formatKW,
  getWeekDates,
  formatDateShort,
  dayNames,
} from "@/lib/utils/calendar";
import { WeekNav } from "@/components/schedule/week-nav";

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

  return (
    <div className="space-y-6">
      {/* Week Navigation */}
      <WeekNav weekNumber={weekNumber} year={year} />

      {/* 7-Column Day Grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date, index) => (
          <div
            key={index}
            className="min-h-[200px] rounded-lg border bg-card"
          >
            {/* Day Header */}
            <div className="border-b bg-muted/30 px-3 py-2 rounded-t-lg">
              <div className="text-sm font-semibold">
                {dayNames[index]}
              </div>
              <div className="text-xs text-muted-foreground">
                {formatDateShort(date)}
              </div>
            </div>

            {/* Day Content Placeholder */}
            <div className="flex items-center justify-center p-4">
              <span className="text-xs text-muted-foreground">
                Keine Schichten
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
