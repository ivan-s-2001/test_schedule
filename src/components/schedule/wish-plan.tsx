"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Star,
  Loader2,
  Check,
  X,
  MessageSquare,
  Clock,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export type WishRequest = {
  id: string;
  shiftId: string;
  userId: string;
  state: "OPEN" | "ACCEPTED" | "DECLINED";
  note: string | null;
  sentAt: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    nickname: string | null;
    profileImage: string | null;
  };
  shift: {
    id: string;
    scheduleId: string;
    dayOfWeek: number;
    shiftFrom: string;
    shiftTo: string;
    title: string | null;
    division?: {
      id: string;
      title: string;
      color: string;
    } | null;
  };
};

interface WishRequestButtonProps {
  shiftId: string;
  currentUserId: string;
  existingRequest?: WishRequest | null;
}

function requestWord(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "заявка";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return "заявки";
  }
  return "заявок";
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

export function WishRequestButton({
  shiftId,
  existingRequest,
}: WishRequestButtonProps) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [note, setNote] = useState("");

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["mod-requests"] });
    queryClient.invalidateQueries({ queryKey: ["schedule"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/mod-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          shiftId,
          note: note.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Не удалось отправить заявку");
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Заявка на смену отправлена");
      refresh();
      setDialogOpen(false);
      setNote("");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const cancelMutation = useMutation({
    mutationFn: async (requestId: string) => {
      const response = await fetch(`/api/mod-requests/${requestId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Не удалось отозвать заявку");
      }

      return response.json();
    },
    onSuccess: () => {
      toast.success("Заявка отозвана");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  if (existingRequest) {
    const stateConfig = {
      OPEN: {
        icon: Clock,
        label: "На рассмотрении",
        className: "bg-amber-50 text-amber-700",
      },
      ACCEPTED: {
        icon: CheckCircle2,
        label: "Одобрено",
        className: "bg-green-50 text-green-700",
      },
      DECLINED: {
        icon: XCircle,
        label: "Отклонено",
        className: "bg-red-50 text-red-700",
      },
    } as const;
    const config = stateConfig[existingRequest.state];
    const Icon = config.icon;

    return (
      <div className="flex items-center gap-1.5">
        <Badge
          variant="secondary"
          className={cn("gap-1 px-1.5 py-0 text-[10px]", config.className)}
        >
          <Icon className="size-2.5" />
          {config.label}
        </Badge>

        {existingRequest.state === "OPEN" && (
          <button
            type="button"
            className="text-muted-foreground transition-colors hover:text-destructive"
            title="Отозвать заявку"
            aria-label="Отозвать заявку на смену"
            onClick={() => {
              if (confirm("Отозвать заявку на эту смену?")) {
                cancelMutation.mutate(existingRequest.id);
              }
            }}
            disabled={cancelMutation.isPending}
          >
            {cancelMutation.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <X className="size-3" />
            )}
          </button>
        )}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className="flex items-center gap-1 text-[10px] text-amber-700 transition-colors hover:text-amber-800"
        onClick={() => setDialogOpen(true)}
      >
        <Star className="size-3" />
        Хочу эту смену
      </button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Заявка на смену</DialogTitle>
            <DialogDescription>
              Сообщите руководителю, что хотите работать в эту смену.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Textarea
              placeholder="Комментарий для руководителя — необязательно"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDialogOpen(false)}
            >
              Отмена
            </Button>
            <Button
              size="sm"
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="gap-1.5"
            >
              {createMutation.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Star className="size-3.5" />
              )}
              Отправить заявку
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface WishCountBadgeProps {
  shiftId: string;
  scheduleId: string;
}

export function WishCountBadge({ shiftId, scheduleId }: WishCountBadgeProps) {
  const { data } = useQuery<{ requests: WishRequest[] }>({
    queryKey: ["mod-requests", scheduleId],
    queryFn: async () => {
      const response = await fetch(`/api/mod-requests?scheduleId=${scheduleId}`);
      if (!response.ok) return { requests: [] };
      return response.json();
    },
    enabled: Boolean(scheduleId),
  });

  const requests = (data?.requests ?? []).filter(
    (request) => request.shiftId === shiftId && request.state === "OPEN"
  );

  if (requests.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative"
          onClick={(event) => event.stopPropagation()}
          title={`${requests.length} ${requestWord(requests.length)}`}
        >
          <Badge
            variant="secondary"
            className="cursor-pointer gap-1 bg-amber-50 px-1.5 py-0 text-[10px] text-amber-700 hover:bg-amber-100"
          >
            <Star className="size-2.5 fill-amber-500" />
            {requests.length}
          </Badge>
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-80 p-0"
        onClick={(event) => event.stopPropagation()}
      >
        <WishRequestsList requests={requests} scheduleId={scheduleId} />
      </PopoverContent>
    </Popover>
  );
}

function WishRequestsList({
  requests,
  scheduleId,
}: {
  requests: WishRequest[];
  scheduleId: string;
}) {
  const queryClient = useQueryClient();

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["mod-requests"] });
    queryClient.invalidateQueries({ queryKey: ["schedule"] });
  };

  const updateRequest = async (
    requestId: string,
    state: "ACCEPTED" | "DECLINED"
  ) => {
    const response = await fetch(`/api/mod-requests/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state }),
    });

    if (!response.ok) {
      const result = await response.json();
      throw new Error(result.error || "Не удалось обработать заявку");
    }

    return response.json();
  };

  const acceptMutation = useMutation({
    mutationFn: (requestId: string) => updateRequest(requestId, "ACCEPTED"),
    onSuccess: () => {
      toast.success("Заявка одобрена, сотрудник назначен на смену");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const declineMutation = useMutation({
    mutationFn: (requestId: string) => updateRequest(requestId, "DECLINED"),
    onSuccess: () => {
      toast.success("Заявка отклонена");
      refresh();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const acceptAllMutation = useMutation({
    mutationFn: async () => {
      const results = await Promise.allSettled(
        requests.map((request) => updateRequest(request.id, "ACCEPTED"))
      );
      return {
        accepted: results.filter((result) => result.status === "fulfilled").length,
        failed: results.filter((result) => result.status === "rejected").length,
      };
    },
    onSuccess: ({ accepted, failed }) => {
      toast.success(
        failed > 0
          ? `Одобрено: ${accepted}. Не удалось обработать: ${failed}.`
          : `Все заявки одобрены: ${accepted}`
      );
      refresh();
    },
    onError: () => toast.error("Не удалось обработать заявки"),
  });

  const isPending =
    acceptMutation.isPending ||
    declineMutation.isPending ||
    acceptAllMutation.isPending;

  return (
    <div>
      <div className="flex items-center justify-between border-b bg-muted/30 px-3 py-2">
        <span className="text-xs font-semibold">
          {requests.length} {requestWord(requests.length)}
        </span>
        {requests.length > 1 && (
          <Button
            variant="ghost"
            size="xs"
            className="gap-1 text-[10px] text-green-700"
            onClick={() => acceptAllMutation.mutate()}
            disabled={isPending}
          >
            {acceptAllMutation.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Check className="size-3" />
            )}
            Одобрить все
          </Button>
        )}
      </div>

      <div className="max-h-[320px] overflow-y-auto">
        {requests.map((request) => (
          <div
            key={request.id}
            className={cn(
              "flex items-start gap-2 border-b px-3 py-2 last:border-b-0",
              isPending && "pointer-events-none opacity-60"
            )}
          >
            <Avatar size="sm" className="mt-0.5">
              <AvatarFallback className="text-[9px]">
                {getInitials(request.user.firstName, request.user.lastName)}
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium">
                {request.user.firstName} {request.user.lastName}
              </div>
              {request.note && (
                <div className="mt-0.5 flex items-start gap-1">
                  <MessageSquare className="mt-0.5 size-2.5 shrink-0 text-muted-foreground" />
                  <span className="line-clamp-2 text-[10px] text-muted-foreground">
                    {request.note}
                  </span>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md bg-green-50 text-green-700 transition-colors hover:bg-green-100"
                title="Одобрить"
                aria-label="Одобрить заявку"
                onClick={() => acceptMutation.mutate(request.id)}
                disabled={isPending}
              >
                <Check className="size-3.5" />
              </button>
              <button
                type="button"
                className="flex size-7 items-center justify-center rounded-md bg-red-50 text-red-700 transition-colors hover:bg-red-100"
                title="Отклонить"
                aria-label="Отклонить заявку"
                onClick={() => declineMutation.mutate(request.id)}
                disabled={isPending}
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

interface WishFilterToggleProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  wishCount: number;
}

export function WishFilterToggle({
  enabled,
  onToggle,
  wishCount,
}: WishFilterToggleProps) {
  if (wishCount === 0) return null;

  return (
    <Button
      variant={enabled ? "default" : "outline"}
      size="sm"
      className={cn(
        "gap-1.5",
        enabled
          ? "bg-amber-600 hover:bg-amber-700"
          : "border-amber-200 text-amber-700 hover:bg-amber-50"
      )}
      onClick={() => onToggle(!enabled)}
    >
      <Star className={cn("size-3.5", enabled && "fill-white")} />
      Заявки на смены
      <Badge
        variant="secondary"
        className={cn(
          "ml-0.5 px-1 py-0 text-[10px]",
          enabled
            ? "bg-amber-500 text-white"
            : "bg-amber-100 text-amber-700"
        )}
      >
        {wishCount}
      </Badge>
    </Button>
  );
}
