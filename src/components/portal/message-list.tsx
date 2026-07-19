"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  CheckSquare,
  Mail,
  MailOpen,
  MailPlus,
  RotateCcw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { ComposeMessage } from "./compose-message";

interface Recipient {
  userId: string;
  isRead: boolean;
  isDeleted: boolean;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

interface MessageItem {
  id: string;
  subject: string;
  body: string;
  createdAt: string;
  sender: {
    id: string;
    firstName: string;
    lastName: string;
    profileImage: string | null;
  };
  recipients: Recipient[];
}

interface Props {
  folder: "inbox" | "sent" | "trash";
}

const folderLabels = {
  inbox: "Входящие",
  sent: "Отправленные",
  trash: "Корзина",
};

const folderDescriptions = {
  inbox: "Сообщения от сотрудников и руководителей",
  sent: "Отправленные вами сообщения",
  trash: "Удалённые сообщения",
};

export function MessageList({ folder }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [composeOpen, setComposeOpen] = useState(false);

  const { data, isLoading } = useQuery<{
    messages: MessageItem[];
    unreadCount?: number;
  }>({
    queryKey: ["messages", folder],
    queryFn: () => fetch(`/api/messages?folder=${folder}`).then((response) => response.json()),
  });

  const messages = data?.messages ?? [];

  const patchMutation = useMutation({
    mutationFn: async ({
      ids,
      patch,
    }: {
      ids: string[];
      patch: Record<string, boolean>;
    }) => {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/messages/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(patch),
          })
        )
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setSelected(new Set());
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(
        ids.map((id) => fetch(`/api/messages/${id}`, { method: "DELETE" }))
      );
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      setSelected(new Set());
      toast.success("Сообщения удалены");
    },
  });

  function toggleSelect(id: string) {
    setSelected((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === messages.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(messages.map((message) => message.id)));
    }
  }

  function isUnread(message: MessageItem) {
    if (folder === "sent") return false;
    return message.recipients?.[0]?.isRead === false;
  }

  return (
    <div className="space-y-5">
      <header className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1>{folderLabels[folder]}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {folderDescriptions[folder]}
          </p>
        </div>
        <Button onClick={() => setComposeOpen(true)}>
          <MailPlus className="size-4" />
          Новое сообщение
        </Button>
      </header>

      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-[var(--accent-border)] bg-[var(--accent-subtle)] p-2">
          <span className="px-1.5 text-xs font-medium text-[var(--accent-strong)]">
            Выбрано: {selected.size}
          </span>
          {folder === "inbox" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  patchMutation.mutate({
                    ids: Array.from(selected),
                    patch: { isRead: true },
                  })
                }
              >
                <MailOpen className="size-4" />
                Отметить прочитанными
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  patchMutation.mutate({
                    ids: Array.from(selected),
                    patch: { isDeleted: true },
                  })
                }
              >
                <Trash2 className="size-4" />
                В корзину
              </Button>
            </>
          )}
          {folder === "trash" && (
            <>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  patchMutation.mutate({
                    ids: Array.from(selected),
                    patch: { isDeleted: false },
                  })
                }
              >
                <RotateCcw className="size-4" />
                Восстановить
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={() => deleteMutation.mutate(Array.from(selected))}
              >
                <Trash2 className="size-4" />
                Удалить навсегда
              </Button>
            </>
          )}
        </div>
      )}

      {isLoading ? (
        <div className="overflow-hidden rounded-lg border border-border">
          {[1, 2, 3, 4].map((item) => (
            <div
              key={item}
              className="h-16 animate-pulse border-b border-border bg-[var(--outline-input-background)] last:border-b-0"
            />
          ))}
        </div>
      ) : messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-[var(--accent-subtle)] py-16 text-center">
          <Mail className="mb-3 size-9 text-muted-foreground/45" />
          <p className="text-sm font-medium">Сообщений нет</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {folder === "inbox" && "Новые сообщения появятся здесь."}
            {folder === "sent" && "Вы ещё не отправляли сообщений."}
            {folder === "trash" && "Корзина пуста."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <div className="flex items-center gap-3 border-b border-border bg-[var(--outline-input-background)] px-3 py-2">
            <Checkbox
              checked={selected.size === messages.length && messages.length > 0}
              onCheckedChange={toggleAll}
            />
            <button
              type="button"
              onClick={toggleAll}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
            >
              <CheckSquare className="size-3.5" />
              Выбрать все
            </button>
          </div>

          {messages.map((message) => {
            const unread = isUnread(message);

            return (
              <div
                key={message.id}
                className={cn(
                  "flex items-center gap-3 border-b border-border px-3 py-3 transition-colors last:border-b-0 hover:bg-[var(--accent-subtle)]",
                  unread && "bg-[var(--accent-subtle)]"
                )}
              >
                <Checkbox
                  checked={selected.has(message.id)}
                  onCheckedChange={() => toggleSelect(message.id)}
                  onClick={(event) => event.stopPropagation()}
                />
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => router.push(`/portal/inbox?id=${message.id}`)}
                >
                  <span
                    className={cn(
                      "size-2 shrink-0 rounded-full",
                      unread ? "bg-primary" : "bg-transparent"
                    )}
                  />

                  <span className="w-36 shrink-0 truncate text-sm">
                    <span className={cn(unread && "font-semibold")}>
                      {folder === "sent"
                        ? message.recipients
                            .map((recipient) =>
                              recipient.user
                                ? `${recipient.user.firstName} ${recipient.user.lastName}`
                                : "Неизвестный пользователь"
                            )
                            .join(", ")
                        : `${message.sender.firstName} ${message.sender.lastName}`}
                    </span>
                  </span>

                  <span className="min-w-0 flex-1 truncate text-sm">
                    <span className={cn(unread && "font-semibold")}>
                      {message.subject}
                    </span>
                    <span className="ml-2 text-muted-foreground">
                      {message.body.length > 90
                        ? `${message.body.slice(0, 90)}…`
                        : message.body}
                    </span>
                  </span>

                  <time className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                    {format(new Date(message.createdAt), "dd MMM yyyy, HH:mm", {
                      locale: ru,
                    })}
                  </time>
                </button>
              </div>
            );
          })}
        </div>
      )}

      <ComposeMessage open={composeOpen} onOpenChange={setComposeOpen} />
    </div>
  );
}
