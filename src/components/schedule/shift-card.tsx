"use client";

import { Clock, Pause, Users, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { ShiftData } from "@/types/schedule";

interface ShiftCardProps {
  shift: ShiftData;
  onEdit: (shift: ShiftData) => void;
  isManager: boolean;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function ShiftCard({ shift, onEdit, isManager }: ShiftCardProps) {
  const bookedCount = shift.bookings.length;
  const isFull = bookedCount >= shift.maxEmployees;
  const emptySlots = Math.max(0, shift.maxEmployees - bookedCount);
  const divisionColor = shift.division?.color ?? "#94a3b8";

  const hasPause = shift.pauseValue > 0;
  const pauseLabel =
    shift.pauseOption === "PER_HOUR"
      ? `${shift.pauseValue} Min/Std`
      : `${shift.pauseValue} Min/Schicht`;

  return (
    <div
      className={cn(
        "group rounded-lg border bg-card shadow-sm transition-shadow hover:shadow-md",
        "overflow-hidden"
      )}
      style={{ borderLeftWidth: "3px", borderLeftColor: divisionColor }}
    >
      {/* Header - clickable for edit */}
      <button
        type="button"
        className={cn(
          "w-full text-left px-3 py-2 space-y-1",
          isManager && "cursor-pointer hover:bg-muted/40 transition-colors"
        )}
        onClick={() => isManager && onEdit(shift)}
        disabled={!isManager}
      >
        {/* Top row: badge + time */}
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant={isFull ? "default" : "secondary"}
            className={cn(
              "text-[10px] px-1.5 py-0",
              isFull && "bg-green-600 hover:bg-green-600"
            )}
          >
            <Users className="size-3" />
            {bookedCount}/{shift.maxEmployees}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {shift.shiftFrom} - {shift.shiftTo}
          </div>
        </div>

        {/* Division name */}
        {shift.division && (
          <div className="text-xs font-medium truncate" style={{ color: divisionColor }}>
            {shift.division.title}
          </div>
        )}

        {/* Title */}
        {shift.title && (
          <div className="text-xs text-foreground truncate font-medium">
            {shift.title}
          </div>
        )}

        {/* Pause info */}
        {hasPause && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Pause className="size-2.5" />
            {pauseLabel}
          </div>
        )}
      </button>

      {/* Content - employee slots */}
      <div className="px-3 pb-2 space-y-1">
        {/* Booked employees */}
        {shift.bookings.map((booking) => (
          <div
            key={booking.id}
            className="flex items-center gap-2 py-0.5 group/slot"
          >
            <Avatar size="sm">
              <AvatarFallback className="text-[9px]">
                {getInitials(booking.user.firstName, booking.user.lastName)}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs truncate flex-1">
              {booking.user.firstName} {booking.user.lastName}
            </span>
            {/* Unbook button - visible on hover for managers, handled in Task 11 */}
            {isManager && (
              <button
                type="button"
                className="opacity-0 group-hover/slot:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                title="Abbuchen"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        ))}

        {/* Empty slots */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div
            key={`empty-${i}`}
            className="flex items-center gap-2 py-0.5"
          >
            <div className="size-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
              <span className="text-[9px] text-muted-foreground/50">?</span>
            </div>
            <span className="text-xs text-muted-foreground/50 italic">
              Frei
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
