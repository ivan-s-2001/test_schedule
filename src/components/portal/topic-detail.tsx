"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ArrowLeft,
  Send,
  Trash2,
  MessageCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface UserInfo {
  id: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
}

interface Post {
  id: string;
  text: string;
  createdAt: string;
  user: UserInfo;
}

interface TopicFull {
  id: string;
  title: string;
  createdAt: string;
  createdById: string;
  creator: UserInfo | null;
  posts: Post[];
}

interface Props {
  topicId: string;
}

export function TopicDetail({ topicId }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");

  const { data, isLoading } = useQuery<{ topic: TopicFull }>({
    queryKey: ["topics", topicId],
    queryFn: () => fetch(`/api/topics/${topicId}`).then((r) => r.json()),
  });

  const postMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/topics/${topicId}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics", topicId] });
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      setText("");
      toast.success("Beitrag hinzugefuegt");
    },
    onError: () => {
      toast.error("Ошибка создания");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/topics/${topicId}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["topics"] });
      toast.success("Thema geloescht");
      router.push("/portal/topics");
    },
    onError: (error: Error) => {
      toast.error(error.message === "Недостаточно прав" ? "Nur Admins koennen Themen loeschen" : "Ошибка удаления");
    },
  });

  function initials(user: UserInfo) {
    return (user.firstName[0] + user.lastName[0]).toUpperCase();
  }

  if (isLoading) {
    return (
      <div className="flex-1 space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
        <div className="h-32 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  const topic = data?.topic;
  if (!topic) {
    return (
      <div className="flex-1">
        <Button variant="ghost" onClick={() => router.push("/portal/topics")} className="gap-2 mb-4">
          <ArrowLeft className="size-4" />
          Zurueck
        </Button>
        <p className="text-slate-500">Thema nicht gefunden.</p>
      </div>
    );
  }

  return (
    <div className="flex-1">
      {/* Back button */}
      <Button variant="ghost" onClick={() => router.push("/portal/topics")} className="gap-2 mb-4">
        <ArrowLeft className="size-4" />
        Zurueck zu Themen
      </Button>

      <div className="rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-800">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-5 dark:border-slate-800">
          <div>
            <h2 className="text-xl font-bold">{topic.title}</h2>
            <div className="mt-1 flex items-center gap-2 text-sm text-slate-500">
              {topic.creator && (
                <span>
                  Erstellt von {topic.creator.firstName} {topic.creator.lastName}
                </span>
              )}
              <span>
                am {format(new Date(topic.createdAt), "dd. MMMM yyyy", { locale: ru })}
              </span>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700"
            onClick={() => deleteMutation.mutate()}
          >
            <Trash2 className="size-4" />
          </Button>
        </div>

        {/* Posts */}
        <div className="divide-y dark:divide-slate-800">
          {topic.posts.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-500">
              <MessageCircle className="mb-2 size-8 text-slate-300" />
              <p className="text-sm">Noch keine Beitraege. Schreibe den ersten!</p>
            </div>
          ) : (
            topic.posts.map((post) => (
              <div key={post.id} className="flex gap-3 p-5">
                <Avatar className="size-9 shrink-0">
                  <AvatarFallback className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300">
                    {initials(post.user)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium">
                      {post.user.firstName} {post.user.lastName}
                    </span>
                    <time className="text-xs text-slate-400">
                      {format(new Date(post.createdAt), "dd. MMM yyyy, HH:mm", { locale: ru })}
                    </time>
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                    {post.text}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* New post */}
        <Separator />
        <div className="p-5">
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Beitrag schreiben..."
            className="min-h-[80px]"
          />
          <div className="mt-3 flex justify-end">
            <Button
              onClick={() => postMutation.mutate()}
              disabled={!text.trim() || postMutation.isPending}
              className="gap-2"
            >
              <Send className="size-4" />
              {postMutation.isPending ? "Sende..." : "Beitrag senden"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
