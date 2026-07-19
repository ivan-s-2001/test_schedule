"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Send, X, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface Employee {
  id: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    profileImage: string | null;
  };
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultRecipientIds?: string[];
  defaultSubject?: string;
}

export function ComposeMessage({ open, onOpenChange, defaultRecipientIds, defaultSubject }: Props) {
  const queryClient = useQueryClient();
  const [recipientIds, setRecipientIds] = useState<string[]>(defaultRecipientIds ?? []);
  const [subject, setSubject] = useState(defaultSubject ?? "");
  const [body, setBody] = useState("");
  const [recipientPickerOpen, setRecipientPickerOpen] = useState(false);

  const { data: employeesData } = useQuery<{ members: Employee[] }>({
    queryKey: ["employees", "all"],
    queryFn: () => fetch("/api/employees?status=all").then((r) => r.json()),
    enabled: open,
  });

  const employees = employeesData?.members ?? [];

  const sendMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, body, recipientIds }),
      });
      if (!res.ok) throw new Error("Failed to send");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["messages"] });
      toast.success("Nachricht gesendet");
      resetForm();
      onOpenChange(false);
    },
    onError: () => {
      toast.error("Fehler beim Senden");
    },
  });

  function resetForm() {
    setRecipientIds([]);
    setSubject("");
    setBody("");
  }

  function toggleRecipient(userId: string) {
    setRecipientIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  }

  function removeRecipient(userId: string) {
    setRecipientIds((prev) => prev.filter((id) => id !== userId));
  }

  const selectedEmployees = employees.filter((e) => recipientIds.includes(e.user.id));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); onOpenChange(o); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Новое сообщение</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Recipients */}
          <div>
            <Label>Получатели</Label>
            <div className="mt-1.5">
              <Popover open={recipientPickerOpen} onOpenChange={setRecipientPickerOpen}>
                <PopoverTrigger asChild>
                  <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border px-3 py-2 cursor-pointer hover:border-indigo-400 dark:border-slate-700">
                    {selectedEmployees.length === 0 ? (
                      <span className="text-sm text-slate-400">Empfaenger auswaehlen...</span>
                    ) : (
                      selectedEmployees.map((emp) => (
                        <Badge key={emp.user.id} variant="secondary" className="gap-1">
                          {emp.user.firstName} {emp.user.lastName}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              removeRecipient(emp.user.id);
                            }}
                            className="ml-0.5 hover:text-red-500"
                          >
                            <X className="size-3" />
                          </button>
                        </Badge>
                      ))
                    )}
                  </div>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Найти сотрудника..." />
                    <CommandList>
                      <CommandEmpty>Kein Mitarbeiter gefunden.</CommandEmpty>
                      <CommandGroup>
                        {employees.map((emp) => (
                          <CommandItem
                            key={emp.user.id}
                            value={`${emp.user.firstName} ${emp.user.lastName} ${emp.user.email}`}
                            onSelect={() => toggleRecipient(emp.user.id)}
                          >
                            <Check
                              className={cn(
                                "mr-2 size-4",
                                recipientIds.includes(emp.user.id) ? "opacity-100" : "opacity-0"
                              )}
                            />
                            <div>
                              <div className="text-sm font-medium">
                                {emp.user.firstName} {emp.user.lastName}
                              </div>
                              <div className="text-xs text-slate-500">{emp.user.email}</div>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Subject */}
          <div>
            <Label>Тема</Label>
            <Input
              className="mt-1.5"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Betreff eingeben..."
            />
          </div>

          {/* Body */}
          <div>
            <Label>Сообщение</Label>
            <Textarea
              className="mt-1.5 min-h-[160px]"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Nachricht schreiben..."
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => { resetForm(); onOpenChange(false); }}>
              Abbrechen
            </Button>
            <Button
              onClick={() => sendMutation.mutate()}
              disabled={!subject.trim() || !body.trim() || recipientIds.length === 0 || sendMutation.isPending}
              className="gap-2"
            >
              <Send className="size-4" />
              {sendMutation.isPending ? "Sende..." : "Отправить"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
