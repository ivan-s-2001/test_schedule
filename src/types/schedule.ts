/**
 * Shared types for schedule, shift, booking and day-note data
 * as returned by the API.
 */

export type BookingUser = {
  id: string;
  firstName: string;
  lastName: string;
  nickname: string | null;
  profileImage: string | null;
};

export type ShiftBooking = {
  id: string;
  shiftId: string;
  userId: string;
  bookedAt: string;
  bookedBy: string | null;
  overtimeMinutes: number;
  user: BookingUser;
};

export type ShiftDivision = {
  id: string;
  title: string;
  color: string;
};

export type ShiftData = {
  id: string;
  scheduleId: string;
  divisionId: string | null;
  dayOfWeek: number;
  shiftFrom: string;
  shiftTo: string;
  maxEmployees: number;
  pauseOption: "PER_HOUR" | "PER_SHIFT";
  pauseValue: number;
  title: string | null;
  description: string | null;
  createdAt: string;
  deletedAt: string | null;
  division: ShiftDivision | null;
  bookings: ShiftBooking[];
};

export type ScheduleLayout = "LAYOUT_1" | "LAYOUT_2";

export type BriefingData = {
  id: string;
  scheduleId: string;
  text: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleDayNote = {
  id: string;
  scheduleId: string;
  dayOfWeek: number;
  note: string;
  createdAt: string;
  updatedAt: string;
};

export type ScheduleData = {
  id: string;
  organizationId: string;
  weekNumber: number;
  year: number;
  isPublic: boolean;
  settingsLayout: ScheduleLayout;
  showTitle: boolean;
  showPauses: boolean;
  shifts: ShiftData[];
  dayNotes: ScheduleDayNote[];
};

export type DivisionOption = {
  id: string;
  title: string;
  color: string;
};
