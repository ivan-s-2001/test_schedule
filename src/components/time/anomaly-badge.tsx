"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  GitMerge,
  Layers,
  TrendingDown,
  Loader2,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ──────────────────────────────────────────────────────────

type AnomalyType = "long_shift" | "gap" | "overlap" | "deviation";
type AnomalySeverity = "warning" | "critical";

type Anomaly = {
  type: AnomalyType;
  severity: AnomalySeverity;
  employeeId: string;
  employeeName: string;
  date: string;
  details: string;
  value: number;
};

type AnomalyResponse = {
  anomalies: Anomaly[];
  summary: {
    total: number;
    critical: number;
    warning: number;
  };
};

// ─── Helpers ────────────────────────────────────────────────────────

const TYPE_LABELS: Record<AnomalyType, string> = {
  long_shift: "Lange Schicht",
  gap: "Fehlende Erfassung",
  overlap: "Ueberlappung",
  deviation: "Soll/Ist-Abweichung",
};

const TYPE_ICONS: Record<AnomalyType, React.ReactNode> = {
  long_shift: <Clock className="size-3.5" />,
  gap: <Layers className="size-3.5" />,
  overlap: <GitMerge className="size-3.5" />,
  deviation: <TrendingDown className="size-3.5" />,
};

// ─── Component ──────────────────────────────────────────────────────

interface AnomalyBadgeProps {
  /** Month in "yyyy-MM" format */
  month: string;
  /** Whether the current user is a manager (controls visibility) */
  isManager: boolean;
}

export function AnomalyBadge({ month, isManager }: AnomalyBadgeProps) {
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading, error } = useQuery<AnomalyResponse>({
    queryKey: ["anomalies", month],
    queryFn: async () => {
      const res = await fetch(`/api/ai/anomalies?month=${month}`);
      if (!res.ok) {
        // If forbidden or feature disabled, return empty
        if (res.status === 403) return { anomalies: [], summary: { total: 0, critical: 0, warning: 0 } };
        throw new Error("Ошибка загрузки der Anomalien");
      }
      return res.json();
    },
    enabled: isManager,
    // Refresh every 5 minutes
    refetchInterval: 5 * 60 * 1000,
  });

  // Don't render for non-managers or when loading / empty
  if (!isManager) return null;
  if (isLoading) {
    return (
      <Badge variant="outline" className="gap-1 text-xs text-muted-foreground">
        <Loader2 className="size-3 animate-spin" />
        Pruefe...
      </Badge>
    );
  }
  if (error || !data || data.summary.total === 0) return null;

  const { anomalies, summary } = data;
  const hasCritical = summary.critical > 0;

  return (
    <div className="space-y-2">
      {/* Badge button */}
      <Button
        variant="ghost"
        size="sm"
        className={cn(
          "gap-1.5 h-7 px-2",
          hasCritical
            ? "text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
            : "text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50 dark:text-yellow-400 dark:hover:bg-yellow-950/30"
        )}
        onClick={() => setExpanded(!expanded)}
      >
        <AlertTriangle className="size-3.5" />
        <span className="text-xs font-medium">
          {summary.total} Anomalie{summary.total !== 1 ? "n" : ""}
        </span>
        {summary.critical > 0 && (
          <Badge
            variant="destructive"
            className="text-[9px] px-1 py-0 h-4"
          >
            {summary.critical} kritisch
          </Badge>
        )}
        {expanded ? (
          <ChevronUp className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        )}
      </Button>

      {/* Expanded detail list */}
      {expanded && (
        <Card className="overflow-hidden">
          <div className="max-h-80 overflow-y-auto divide-y">
            {anomalies.map((anomaly, idx) => (
              <div
                key={`${anomaly.type}-${anomaly.employeeId}-${anomaly.date}-${idx}`}
                className={cn(
                  "flex items-start gap-3 px-4 py-3 text-sm",
                  anomaly.severity === "critical"
                    ? "bg-red-50/50 dark:bg-red-950/10"
                    : "bg-yellow-50/50 dark:bg-yellow-950/10"
                )}
              >
                {/* Type icon */}
                <div
                  className={cn(
                    "mt-0.5 shrink-0",
                    anomaly.severity === "critical"
                      ? "text-red-500"
                      : "text-yellow-500"
                  )}
                >
                  {TYPE_ICONS[anomaly.type]}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">
                      {anomaly.employeeName}
                    </span>
                    <Badge
                      variant={
                        anomaly.severity === "critical"
                          ? "destructive"
                          : "secondary"
                      }
                      className={cn(
                        "text-[9px] px-1.5 py-0 shrink-0",
                        anomaly.severity === "warning" &&
                          "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                      )}
                    >
                      {TYPE_LABELS[anomaly.type]}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {anomaly.details}
                  </p>
                  <p className="text-[10px] text-muted-foreground/70">
                    {anomaly.date}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── Per-Employee Anomaly Indicator ─────────────────────────────────

interface EmployeeAnomalyIndicatorProps {
  /** All anomalies for the month */
  anomalies: Anomaly[];
  /** Employee user ID to filter for */
  employeeId: string;
}

/**
 * Small inline indicator showing anomaly count for a specific employee.
 * Used in the time records list next to each employee row.
 */
export function EmployeeAnomalyIndicator({
  anomalies,
  employeeId,
}: EmployeeAnomalyIndicatorProps) {
  const employeeAnomalies = anomalies.filter(
    (a) => a.employeeId === employeeId
  );

  if (employeeAnomalies.length === 0) return null;

  const hasCritical = employeeAnomalies.some(
    (a) => a.severity === "critical"
  );

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-[9px] px-1.5 py-0 gap-0.5",
        hasCritical
          ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
          : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
      )}
      title={employeeAnomalies.map((a) => a.details).join("\n")}
    >
      <AlertTriangle className="size-2.5" />
      {employeeAnomalies.length}
    </Badge>
  );
}
