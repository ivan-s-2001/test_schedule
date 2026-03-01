/**
 * Shared types for schedule, shift, and booking data
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

export type ScheduleData = {
  id: string;
  organizationId: string;
  weekNumber: number;
  year: number;
  isPublic: boolean;
  shifts: ShiftData[];
};

export type DivisionOption = {
  id: string;
  title: string;
  color: string;
};
