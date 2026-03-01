import { redirect } from "next/navigation";
import { getCurrentKW, formatKW } from "@/lib/utils/calendar";

export default function ScheduleFlexiblePage() {
  const { weekNumber, year } = getCurrentKW();
  redirect(`/schedule/flexible/${formatKW(weekNumber, year)}`);
}
