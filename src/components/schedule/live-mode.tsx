"use client";

import { useCallback, useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Radio,
  Square,
  Loader2,
  Clock,
  UserPlus,
  UserMinus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSocket, useSocketEvent } from "@/lib/socket";

type LiveDayData = {
  id: string;
  liveSessionId: string;
  dayOfWeek: number;
  enabled: boolean;
};

type LiveLogUser = {
  id: string;
  firstName: string;
  lastName: string;
};

type LiveLogData = {
  id: string;
  liveSessionId: string;
  shiftId: string;
  userId: string;
  action: "BOOK" | "UNBOOK";
  loggedAt: string;
  user: LiveLogUser;
};

type LiveSessionData = {
  id: string;
  scheduleId: string;
  isActive: boolean;
  startedAt: string;
  deadline: string | null;
  autoStop: boolean;
  allowExceeds: boolean;
  bookRequests: boolean;
  days: LiveDayData[];
  logs: LiveLogData[];
};

interface LiveModeProps {
  scheduleId: string;
  isManager: boolean;
}

function dayDate(dayOfWeek: number): Date {
  return new Date(2024, 0, dayOfWeek);
}

export function LiveMode({ scheduleId, isManager }: LiveModeProps) {
  const queryClient = useQueryClient();
  const { joinSchedule, leaveSchedule } = useSocket();
  const t = useTranslations("schedule.live");
  const tErrors = useTranslations("errors");
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!scheduleId) return;
    joinSchedule(scheduleId);
    return () => leaveSchedule(scheduleId);
  }, [scheduleId, joinSchedule, leaveSchedule]);

  const { data, isLoading } = useQuery<{ session: LiveSessionData | null }>({
    queryKey: ["live-session", scheduleId],
    queryFn: async () => {
      const response = await fetch(`/api/live?scheduleId=${scheduleId}`);
      if (!response.ok) throw new Error(tErrors("loadSchedule"));
      return response.json();
    },
    enabled: Boolean(scheduleId),
  });

  const session = data?.session ?? null;
  const isActive = session?.isActive ?? false;

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["live-session", scheduleId] });
    queryClient.invalidateQueries({ queryKey: ["schedule"] });
  }, [queryClient, scheduleId]);

  useSocketEvent("live:started", refresh);
  useSocketEvent("live:stopped", refresh);
  useSocketEvent("live:updated", refresh);
  useSocketEvent("live:booking", refresh);

  const startMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scheduleId }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || tErrors("save"));
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success(t("opened"));
      refresh();
      setExpanded(true);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const stopMutation = useMutation({
    mutationFn: async () => {
      if (!session) return;
      const response = await fetch(`/api/live?id=${session.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || tErrors("save"));
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success(t("closed"));
      refresh();
      setExpanded(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (isLoading) return null;

  const isPending = startMutation.isPending || stopMutation.isPending;

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2">
        {isManager && !isActive && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-purple-300 text-purple-700 hover:bg-purple-50"
            onClick={() => startMutation.mutate()}
            disabled={isPending}
          >
            {startMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Radio className="size-3.5" />
            )}
            {t("open")}
          </Button>
        )}

        {isManager && isActive && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 border-red-300 text-red-700 hover:bg-red-50"
            onClick={() => {
              if (confirm(t("confirmClose"))) stopMutation.mutate();
            }}
            disabled={isPending}
          >
            {stopMutation.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Square className="size-3.5" />
            )}
            {t("close")}
          </Button>
        )}

        {isActive && (
          <button
            type="button"
            className="flex items-center gap-1.5"
            onClick={() => setExpanded((value) => !value)}
          >
            <Badge className="cursor-pointer gap-1.5 bg-purple-600 hover:bg-purple-700">
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-purple-300 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-white" />
              </span>
              {t("opened")}
              {expanded ? (
                <ChevronUp className="size-3" />
              ) : (
                <ChevronDown className="size-3" />
              )}
            </Badge>
          </button>
        )}
      </div>

      {isActive && expanded && session && (
        <LivePanel
          session={session}
          isManager={isManager}
          scheduleId={scheduleId}
        />
      )}
    </div>
  );
}

function LivePanel({
  session,
  isManager,
  scheduleId,
}: {
  session: LiveSessionData;
  isManager: boolean;
  scheduleId: string;
}) {
  const t = useTranslations("schedule.live");
  const format = useFormatter();

  return (
    <div className="mt-3 space-y-4 rounded-lg border-2 border-purple-200 bg-purple-50/50 p-4">
      <LiveTimer startedAt={session.startedAt} />

      {isManager ? (
        <DayToggles
          sessionId={session.id}
          days={session.days}
          scheduleId={scheduleId}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">
            {t("canBook")}
          </span>
          {session.days
            .filter((day) => day.enabled)
            .map((day) => (
              <Badge
                key={day.id}
                className="bg-purple-600 text-xs capitalize hover:bg-purple-600"
              >
                {format.dateTime(dayDate(day.dayOfWeek), { weekday: "short" })}
              </Badge>
            ))}
          {!session.days.some((day) => day.enabled) && (
            <span className="text-xs text-muted-foreground">
              {t("noAvailableDays")}
            </span>
          )}
        </div>
      )}

      <LiveLogFeed logs={session.logs} />
    </div>
  );
}

function LiveTimer({ startedAt }: { startedAt: string }) {
  const t = useTranslations("schedule.live");
  const [elapsed, setElapsed] = useState("");

  useEffect(() => {
    const start = new Date(startedAt).getTime();

    function update() {
      const difference = Date.now() - start;
      const hours = Math.floor(difference / 3_600_000);
      const minutes = Math.floor((difference % 3_600_000) / 60_000);
      const seconds = Math.floor((difference % 60_000) / 1000);
      setElapsed(
        `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
      );
    }

    update();
    const timer = setInterval(update, 1000);
    return () => clearInterval(timer);
  }, [startedAt]);

  return (
    <div className="flex items-center gap-2 text-sm text-purple-700">
      <Clock className="size-4" />
      <span className="font-medium">{t("openedFor", { duration: elapsed })}</span>
    </div>
  );
}

function DayToggles({
  sessionId,
  days,
  scheduleId,
}: {
  sessionId: string;
  days: LiveDayData[];
  scheduleId: string;
}) {
  const queryClient = useQueryClient();
  const t = useTranslations("schedule.live");
  const tErrors = useTranslations("errors");
  const format = useFormatter();

  const toggleMutation = useMutation({
    mutationFn: async ({
      dayOfWeek,
      enabled,
    }: {
      dayOfWeek: number;
      enabled: boolean;
    }) => {
      const response = await fetch(`/api/live?id=${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: [{ dayOfWeek, enabled }] }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || tErrors("save"));
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["live-session", scheduleId],
      });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-purple-700">
        {t("availableDays")}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {days.map((day) => (
          <div key={day.id} className="flex items-center gap-1.5">
            <Switch
              size="sm"
              checked={day.enabled}
              onCheckedChange={(checked) =>
                toggleMutation.mutate({
                  dayOfWeek: day.dayOfWeek,
                  enabled: checked,
                })
              }
              disabled={toggleMutation.isPending}
            />
            <Label className="cursor-pointer text-xs capitalize">
              {format.dateTime(dayDate(day.dayOfWeek), { weekday: "short" })}
            </Label>
          </div>
        ))}
      </div>
    </div>
  );
}

function LiveLogFeed({ logs }: { logs: LiveLogData[] }) {
  const t = useTranslations("schedule.live");
  const format = useFormatter();

  if (logs.length === 0) {
    return (
      <div className="py-2 text-center text-xs text-muted-foreground">
        {t("noActions")}
      </div>
    );
  }

  return (
    <div className="max-h-48 space-y-1.5 overflow-y-auto">
      <p className="text-xs font-medium text-purple-700">
        {t("recentActions")}
      </p>
      {logs.map((log) => (
        <div
          key={log.id}
          className="flex items-center gap-2 rounded bg-white/70 px-2 py-1 text-xs"
        >
          {log.action === "BOOK" ? (
            <UserPlus className="size-3 shrink-0 text-green-600" />
          ) : (
            <UserMinus className="size-3 shrink-0 text-red-500" />
          )}
          <span className="font-medium">
            {log.user.firstName} {log.user.lastName}
          </span>
          <span className="text-muted-foreground">
            {log.action === "BOOK" ? t("booked") : t("unbooked")}
          </span>
          <span className="ml-auto shrink-0 text-muted-foreground">
            {format.dateTime(new Date(log.loggedAt), {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      ))}
    </div>
  );
}

export function LiveBorder({
  isActive,
  children,
}: {
  isActive: boolean;
  children: React.ReactNode;
}) {
  if (!isActive) return <>{children}</>;

  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 z-10 animate-pulse rounded-lg border-2 border-purple-400" />
      {children}
    </div>
  );
}
