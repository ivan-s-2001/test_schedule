"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Play, Square, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type RunningWatch = {
  id: string;
  timeFrom: string;
  date: string;
  categoryId: string | null;
  comment: string | null;
  category: { id: string; name: string } | null;
};

type CategoryData = {
  id: string;
  name: string;
  enabled: boolean;
};

function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatElapsed(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function Stopwatch() {
  const queryClient = useQueryClient();
  const [elapsed, setElapsed] = useState(0);
  const [showStopForm, setShowStopForm] = useState(false);
  const [categoryId, setCategoryId] = useState<string>("none");
  const [comment, setComment] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch running watch
  const { data: watchData, isLoading } = useQuery<{ running: RunningWatch | null }>({
    queryKey: ["time-watch"],
    queryFn: async () => {
      const res = await fetch("/api/time/watch");
      if (!res.ok) throw new Error("Failed to fetch watch");
      return res.json();
    },
    refetchInterval: 30000, // refresh every 30s to stay in sync
  });

  const running = watchData?.running ?? null;

  // Fetch categories
  const { data: categoriesData } = useQuery<{ categories: CategoryData[] }>({
    queryKey: ["time-categories"],
    queryFn: async () => {
      const res = await fetch("/api/time/categories");
      if (!res.ok) throw new Error("Failed to fetch categories");
      return res.json();
    },
  });

  const categories = (categoriesData?.categories ?? []).filter(
    (c) => c.enabled
  );

  // Calculate elapsed time from running watch
  const computeElapsed = useCallback(() => {
    if (!running) return 0;
    const now = new Date();
    const startMinutes = parseTimeToMinutes(running.timeFrom);
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const nowSeconds = now.getSeconds();
    let elapsedMinutes = nowMinutes - startMinutes;
    if (elapsedMinutes < 0) elapsedMinutes += 24 * 60;
    return elapsedMinutes * 60 + nowSeconds;
  }, [running]);

  // Timer effect
  useEffect(() => {
    if (running) {
      setElapsed(computeElapsed());
      intervalRef.current = setInterval(() => {
        setElapsed(computeElapsed());
      }, 1000);
    } else {
      setElapsed(0);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [running, computeElapsed]);

  // Start mutation
  const startMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/time/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "START" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Starten");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Секундомер запущен");
      queryClient.invalidateQueries({ queryKey: ["time-watch"] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Stop mutation
  const stopMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/time/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "STOP",
          categoryId: categoryId !== "none" ? categoryId : undefined,
          comment: comment.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Fehler beim Stoppen");
      }
      return res.json();
    },
    onSuccess: () => {
      toast.success("Секундомер остановлен, запись сохранена");
      queryClient.invalidateQueries({ queryKey: ["time-watch"] });
      queryClient.invalidateQueries({ queryKey: ["time-records"] });
      setShowStopForm(false);
      setCategoryId("none");
      setComment("");
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-sm">Lade Stoppuhr...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-4">
      {/* Timer display */}
      <div className="text-center">
        <div
          className={cn(
            "font-mono text-4xl font-bold tabular-nums",
            running ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
          )}
        >
          {formatElapsed(elapsed)}
        </div>
        {running && (
          <p className="text-sm text-muted-foreground mt-1">
            Запущен с {running.timeFrom} Uhr
          </p>
        )}
      </div>

      {/* Controls */}
      {!running && !showStopForm && (
        <div className="flex justify-center">
          <Button
            onClick={() => startMutation.mutate()}
            disabled={startMutation.isPending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
            size="lg"
          >
            {startMutation.isPending ? (
              <Loader2 className="size-5 animate-spin" />
            ) : (
              <Play className="size-5" />
            )}
            Start
          </Button>
        </div>
      )}

      {running && !showStopForm && (
        <div className="flex justify-center">
          <Button
            onClick={() => setShowStopForm(true)}
            variant="destructive"
            size="lg"
          >
            <Square className="size-5" />
            Stop
          </Button>
        </div>
      )}

      {/* Stop form (category + comment before saving) */}
      {showStopForm && (
        <div className="space-y-3 border-t pt-3">
          <p className="text-sm font-medium">Завершить запись</p>

          {categories.length > 0 && (
            <div className="space-y-1.5">
              <Label>Категория</Label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Без категории" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">
                    <span className="text-muted-foreground">
                      Без категории
                    </span>
                  </SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Kommentar (optional)</Label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Notizen..."
              rows={2}
              maxLength={500}
            />
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowStopForm(false)}
              className="flex-1"
            >
              Abbrechen
            </Button>
            <Button
              onClick={() => stopMutation.mutate()}
              disabled={stopMutation.isPending}
              variant="destructive"
              className="flex-1"
            >
              {stopMutation.isPending && (
                <Loader2 className="size-4 animate-spin" />
              )}
              Speichern &amp; Stop
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
