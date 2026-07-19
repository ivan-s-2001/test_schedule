"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Clock, Loader2, Pause, Plus, Users, X } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { EmployeePicker } from "./employee-picker";
import { WishRequestButton, WishCountBadge } from "./wish-plan";
import type { ShiftData, ScheduleLayout } from "@/types/schedule";
import type { WishRequest } from "./wish-plan";

interface ShiftCardProps {
  shift: ShiftData;
  onEdit: (shift: ShiftData) => void;
  isManager: boolean;
  currentUserId?: string;
  highlightUserId?: string | null;
  layout?: ScheduleLayout;
  showTitle?: boolean;
  showPauses?: boolean;
  userWishRequest?: WishRequest | null;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function ShiftCard({
  shift,
  onEdit,
  isManager,
  currentUserId,
  highlightUserId,
  layout = "LAYOUT_1",
  showTitle = true,
  showPauses = true,
  userWishRequest,
}: ShiftCardProps) {
  const queryClient = useQueryClient();
  const bookedCount = shift.bookings.length;
  const isFull = bookedCount >= shift.maxEmployees;
  const emptySlots = Math.max(0, shift.maxEmployees - bookedCount);
  const divisionColor = shift.division?.color ?? "#94a3b8";

  const hasHighlightUser = highlightUserId
    ? shift.bookings.some((booking) => booking.userId === highlightUserId)
    : false;
  const isDimmed = highlightUserId ? !hasHighlightUser : false;

  const hasPause = shift.pauseValue > 0;
  const pauseLabel =
    shift.pauseOption === "PER_HOUR"
      ? `${shift.pauseValue} мин на каждый час`
      : `${shift.pauseValue} мин на всю смену`;

  const bookMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: shift.id, userId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Не удалось назначить сотрудника");
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Сотрудник назначен на смену");
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const unbookMutation = useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch("/api/bookings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shiftId: shift.id, userId }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Не удалось снять сотрудника со смены");
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Сотрудник снят со смены");
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const addPlaceMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(`/api/shifts/${shift.id}/places`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Не удалось добавить место");
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Свободное место добавлено");
      queryClient.invalidateQueries({ queryKey: ["schedule"] });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  function handleUnbook(userId: string, name: string) {
    if (confirm(`Снять сотрудника ${name} с этой смены?`)) {
      unbookMutation.mutate(userId);
    }
  }

  function handleBook(userId: string) {
    bookMutation.mutate(userId);
  }

  const isPending =
    bookMutation.isPending ||
    unbookMutation.isPending ||
    addPlaceMutation.isPending;
  const bookedUserIds = shift.bookings.map((booking) => booking.userId);
  const canSelfBook =
    !isManager &&
    currentUserId &&
    !bookedUserIds.includes(currentUserId) &&
    !isFull;
  const isLayout1 = layout === "LAYOUT_1";

  return (
    <div
      className={cn(
        "group overflow-hidden rounded-lg border bg-card transition-all",
        isLayout1 ? "shadow-sm hover:shadow-md" : "shadow-none",
        isPending && "pointer-events-none opacity-70",
        isDimmed && "scale-[0.98] opacity-40",
        highlightUserId && hasHighlightUser && "ring-2 ring-primary/40"
      )}
      style={
        isLayout1
          ? {}
          : { borderLeftWidth: "3px", borderLeftColor: divisionColor }
      }
    >
      <button
        type="button"
        className={cn(
          "w-full space-y-1 px-3 py-2 text-left",
          isManager && "cursor-pointer transition-colors hover:bg-muted/40"
        )}
        onClick={() => isManager && onEdit(shift)}
        disabled={!isManager}
      >
        <div className="flex items-center justify-between gap-2">
          <Badge
            variant={isFull ? "default" : "secondary"}
            className={cn(
              "px-1.5 py-0 text-[10px]",
              isFull && "bg-green-600 hover:bg-green-600"
            )}
          >
            <Users className="size-3" />
            {bookedCount}/{shift.maxEmployees}
          </Badge>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="size-3" />
            {shift.shiftFrom} — {shift.shiftTo}
          </div>
        </div>

        {shift.division && (
          <div
            className="truncate text-xs font-medium"
            style={{ color: divisionColor }}
          >
            {shift.division.title}
          </div>
        )}

        {showTitle && shift.title && (
          <div className="truncate text-xs font-medium text-foreground">
            {shift.title}
          </div>
        )}

        {showPauses && hasPause && (
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <Pause className="size-2.5" />
            {pauseLabel}
          </div>
        )}

        <div
          className="flex items-center gap-1.5"
          onClick={(event) => event.stopPropagation()}
        >
          {isManager && (
            <WishCountBadge shiftId={shift.id} scheduleId={shift.scheduleId} />
          )}
          {!isManager &&
            currentUserId &&
            !bookedUserIds.includes(currentUserId) && (
              <WishRequestButton
                shiftId={shift.id}
                currentUserId={currentUserId}
                existingRequest={userWishRequest}
              />
            )}
        </div>
      </button>

      <div className="space-y-1 px-3 pb-2">
        {shift.bookings.map((booking) => {
          const canUnbook = isManager || booking.userId === currentUserId;

          return (
            <div
              key={booking.id}
              className={cn(
                "group/slot -mx-0.5 flex items-center gap-2 rounded-sm px-0.5 py-0.5",
                highlightUserId &&
                  booking.userId === highlightUserId &&
                  "bg-primary/10"
              )}
            >
              <Avatar size="sm">
                <AvatarFallback className="text-[9px]">
                  {getInitials(
                    booking.user.firstName,
                    booking.user.lastName
                  )}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate text-xs">
                {booking.user.firstName} {booking.user.lastName}
              </span>
              {canUnbook && (
                <button
                  type="button"
                  className="text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover/slot:opacity-100"
                  title="Снять со смены"
                  aria-label={`Снять ${booking.user.firstName} ${booking.user.lastName} со смены`}
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

        {Array.from({ length: emptySlots }).map((_, index) => (
          <div key={`empty-${index}`}>
            {isManager ? (
              <EmployeePicker
                bookedUserIds={bookedUserIds}
                onSelect={handleBook}
                shiftId={shift.id}
              >
                <button
                  type="button"
                  className="flex w-full cursor-pointer items-center gap-2 rounded py-0.5 transition-colors hover:bg-muted/50"
                >
                  <div className="flex size-6 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 transition-colors hover:border-primary/50">
                    <Plus className="size-3 text-muted-foreground/50" />
                  </div>
                  <span className="text-xs italic text-muted-foreground/60 transition-colors hover:text-muted-foreground">
                    Назначить сотрудника
                  </span>
                </button>
              </EmployeePicker>
            ) : canSelfBook && index === 0 ? (
              <button
                type="button"
                className="flex w-full cursor-pointer items-center gap-2 rounded py-0.5 transition-colors hover:bg-muted/50"
                onClick={() => currentUserId && handleBook(currentUserId)}
              >
                <div className="flex size-6 items-center justify-center rounded-full border-2 border-dashed border-primary/40">
                  <Plus className="size-3 text-primary/60" />
                </div>
                <span className="text-xs italic text-primary/80">
                  Записаться на смену
                </span>
              </button>
            ) : (
              <div className="flex items-center gap-2 py-0.5">
                <div className="flex size-6 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30">
                  <span className="text-[9px] text-muted-foreground/50">?</span>
                </div>
                <span className="text-xs italic text-muted-foreground/60">
                  Свободное место
                </span>
              </div>
            )}
          </div>
        ))}

        {isManager && (
          <button
            type="button"
            className="flex w-full items-center gap-1.5 py-0.5 text-[10px] text-muted-foreground/70 transition-colors hover:text-muted-foreground"
            onClick={() => addPlaceMutation.mutate()}
          >
            <Plus className="size-3" />
            Добавить место
          </button>
        )}
      </div>
    </div>
  );
}
