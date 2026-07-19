"use client";

import { useSocketStatus, type SocketStatus } from "@/lib/socket";
import { cn } from "@/lib/utils";
import { Wifi, WifiOff } from "lucide-react";

const statusConfig: Record<
  SocketStatus,
  { dot: string; text: string; label: string }
> = {
  connected: {
    dot: "bg-[var(--outline-success)]",
    text: "text-sidebar-foreground",
    label: "Подключено",
  },
  disconnected: {
    dot: "bg-destructive",
    text: "text-destructive",
    label: "Нет подключения",
  },
  reconnecting: {
    dot: "animate-pulse bg-[var(--outline-warning)]",
    text: "text-[var(--outline-warning)]",
    label: "Подключение...",
  },
};

export function ConnectionStatus({ compact = false }: { compact?: boolean }) {
  const status = useSocketStatus();
  const config = statusConfig[status];
  const Icon = status === "connected" ? Wifi : WifiOff;

  return (
    <div
      className={cn(
        "flex h-9 shrink-0 items-center rounded-md text-xs transition-colors",
        compact ? "w-9 justify-center" : "gap-1.5 px-2",
        config.text
      )}
      title={`WebSocket: ${config.label}`}
      aria-label={`WebSocket: ${config.label}`}
    >
      <span className="relative">
        <Icon className="size-4" />
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 size-2 rounded-full ring-2 ring-sidebar",
            config.dot
          )}
        />
      </span>
      {!compact && <span>{config.label}</span>}
    </div>
  );
}
