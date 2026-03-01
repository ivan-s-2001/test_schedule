"use client";

import { useMemo } from "react";
import { ScheduleGrid } from "./schedule-grid";

interface ScheduleGridWrapperProps {
  weekNumber: number;
  year: number;
  /** ISO date strings for each day Mon-Sun */
  weekDateStrings: string[];
}

/**
 * Wrapper component that converts serialized date strings
 * back to Date objects for the ScheduleGrid.
 * This is needed because Date objects are serialized when passed
 * from server components to client components.
 */
export function ScheduleGridWrapper({
  weekNumber,
  year,
  weekDateStrings,
}: ScheduleGridWrapperProps) {
  const weekDates = useMemo(
    () => weekDateStrings.map((s) => new Date(s)),
    [weekDateStrings]
  );

  return (
    <ScheduleGrid
      weekNumber={weekNumber}
      year={year}
      weekDates={weekDates}
    />
  );
}
