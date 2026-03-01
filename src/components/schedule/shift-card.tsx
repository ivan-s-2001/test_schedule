"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Loader2, Pause, Plus, Users, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EmployeePicker } from "./employee-picker";
import type { ShiftData } from "@/types/schedule";

interface ShiftCardProps {
  shift: ShiftData;
  onEdit: (shift: ShiftData) => void;
  isManager: boolean;
  /** Current user's ID - needed for self-booking as employee */
  currentUserId?: string;
  /** If set, highlight shifts containing this user and dim others */
  highlightUserId?: string | null;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function ShiftCard({ shift, onEdit, isManager, currentUserId, highlightUserId }: ShiftCardProps) {
  const queryClient = useQueryClient();
  const bookedCount = shift.bookings.length;
  const isFull = bookedCount >= shift.maxEmployees;
  const emptySlots = Math.max(0, shift.maxEmployees - bookedCount);
  const divisionColor = shift.division?.color ?? "#94a3b8";

  // Highlight logic: when a filter is active, dim cards that don't contain the user
  const hasHighlightUser = highlightUserId
    ? shift.bookings.some((b) => b.userId === highlightUserId)
    : false;
  const isDimmed = highlightUserId ? !hasHighlightUser : false;

  const hasPause = shift.pauseValue > 0;
  const pauseLabel =
    shift.pauseOption === "PER_HOUR"
      ? `${shift.pauseValue} Min/Std`
      : `${shift.pauseValue} Min/Schicht`;

  // Book mutation
  const bookMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: shift.id, userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Buchen");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Mitarbeiter gebucht");
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Unbook mutation
  const unbookMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch("/api/bookings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: shift.id, userId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Abbuchen");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Mitarbeiter abgebucht");
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Add place mutation
  const addPlaceMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/shifts/${shift.id}/places`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Hinzufuegen");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Platz hinzugefuegt");
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  function handleUnbook(userId: string, name: string) {
    if (confirm(`${name} wirklich aus der Schicht entfernen?`)) {
      unbookMutation.mutate(userId);
    }
  }

  function handleBook(userId: string) {
    bookMutation.mutate(userId);
  }

  const isPending = bookMutation.isPending || unbookMutation.isPending || addPlaceMutation.isPending;
  const bookedUserIds = shift.bookings.map((b) => b.userId);

  // Can the current user book themselves into an empty slot?
  const canSelfBook =
    !isManager &&
    currentUserId &&
    !bookedUserIds.includes(currentUserId) &&
    !isFull;

  return (
    <div
      className={cn(
        "group rounded-lg border bg-card shadow-sm transition-all hover:shadow-md",
        "overflow-hidden",
        isPending && "opacity-70 pointer-events-none",
        isDimmed && "opacity-40 scale-[0.98]",
        highlightUserId && hasHighlightUser && "ring-2 ring-primary/40"
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
        {shift.bookings.map((booking) => {
          const canUnbook =
            isManager || booking.userId === currentUserId;
          return (
            <div
              key={booking.id}
              className={cn(
                "flex items-center gap-2 py-0.5 group/slot rounded-sm px-0.5 -mx-0.5",
                highlightUserId && booking.userId === highlightUserId && "bg-primary/10"
              )}
            >
              <Avatar size="sm">
                <AvatarFallback className="text-[9px]">
                  {getInitials(booking.user.firstName, booking.user.lastName)}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs truncate flex-1">
                {booking.user.firstName} {booking.user.lastName}
              </span>
              {canUnbook && (
                <button
                  type="button"
                  className="opacity-0 group-hover/slot:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                  title="Abbuchen"
                  onClick={() =>
                    handleUnbook(
                      booking.userId,
                      `${booking.user.firstName} ${booking.user.lastName}`
                    )
                  }
                >
                  {unbookMutation.isPending ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <X className="size-3" />
                  )}
                </button>
              )}
            </div>
          );
        })}

        {/* Empty slots */}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <div key={`empty-${i}`}>
            {isManager ? (
              <EmployeePicker
                bookedUserIds={bookedUserIds}
                onSelect={handleBook}
              >
                <button
                  type="button"
                  className="flex items-center gap-2 py-0.5 w-full rounded hover:bg-muted/50 transition-colors cursor-pointer"
                >
                  <div className="size-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center hover:border-primary/50 transition-colors">
                    <Plus className="size-3 text-muted-foreground/50" />
                  </div>
                  <span className="text-xs text-muted-foreground/50 italic hover:text-muted-foreground transition-colors">
                    Mitarbeiter zuweisen
                  </span>
                </button>
              </EmployeePicker>
            ) : canSelfBook && i === 0 ? (
              <button
                type="button"
                className="flex items-center gap-2 py-0.5 w-full rounded hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => currentUserId && handleBook(currentUserId)}
              >
                <div className="size-6 rounded-full border-2 border-dashed border-primary/40 flex items-center justify-center">
                  <Plus className="size-3 text-primary/60" />
                </div>
                <span className="text-xs text-primary/70 italic">
                  Eintragen
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 py-0.5">
                <div className="size-6 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                  <span className="text-[9px] text-muted-foreground/50">?</span>
                </div>
                <span className="text-xs text-muted-foreground/50 italic">
                  Frei
                </span>
              </div>
            )}
          </div>
        ))}

        {/* + Platz button for managers */}
        {isManager && (
          <button
            type="button"
            className="flex items-center gap-1.5 py-0.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors w-full"
            onClick={() => addPlaceMutation.mutate()}
          >
            <Plus className="size-3" />
            Platz
          </button>
        )}
      </div>
    </div>
  );
}
