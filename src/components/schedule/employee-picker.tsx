"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check, Loader2, Star } from "lucide-react";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type OrgEmployee = {
  id: string;
  role: string;
  user: {
    id: string;
    firstName: string;
    lastName: string;
    nickname: string | null;
    profileImage: string | null;
  };
};

type ScoreBreakdown = {
  hours: number;
  availability: number;
  division: number;
  history: number;
};

type EmployeeScoreData = {
  employeeId: string;
  firstName: string;
  lastName: string;
  score: number;
  breakdown: ScoreBreakdown;
};

interface EmployeePickerProps {
  bookedUserIds: string[];
  onSelect: (userId: string) => void;
  shiftId?: string;
  children: React.ReactNode;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MANAGER: "Руководитель",
  EMPLOYEE: "Сотрудник",
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-amber-100 text-amber-800",
  ADMIN: "bg-purple-100 text-purple-800",
  MANAGER: "bg-blue-100 text-blue-800",
  EMPLOYEE: "bg-gray-100 text-gray-700",
};

function getScoreColor(score: number): string {
  if (score >= 80) return "bg-green-100 text-green-800";
  if (score >= 50) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-800";
}

function formatBreakdown(breakdown: ScoreBreakdown): string {
  return [
    `Нагрузка: ${breakdown.hours}/40`,
    `Доступность: ${breakdown.availability}/30`,
    `Подразделение: ${breakdown.division}/20`,
    `Предыдущие смены: ${breakdown.history}/10`,
  ].join("\n");
}

export function EmployeePicker({
  bookedUserIds,
  onSelect,
  shiftId,
  children,
}: EmployeePickerProps) {
  const [open, setOpen] = useState(false);

  const { data } = useQuery<{ members: OrgEmployee[] }>({
    queryKey: ["employees", "active"],
    queryFn: async () => {
      const response = await fetch("/api/employees?status=active");
      if (!response.ok) throw new Error("Не удалось загрузить сотрудников");
      return response.json();
    },
    enabled: open,
  });

  const { data: scoresData, isLoading: scoresLoading } = useQuery<{
    scores: EmployeeScoreData[];
  }>({
    queryKey: ["ai-recommend", shiftId],
    queryFn: async () => {
      const response = await fetch(`/api/ai/recommend?shiftId=${shiftId}`);
      if (!response.ok) return { scores: [] };
      return response.json();
    },
    enabled: open && Boolean(shiftId),
  });

  const employees = data?.members ?? [];
  const scores = scoresData?.scores ?? [];
  const bookedSet = new Set(bookedUserIds);
  const scoreMap = new Map<string, EmployeeScoreData>();

  for (const score of scores) scoreMap.set(score.employeeId, score);

  const sortedEmployees = [...employees].sort((left, right) => {
    const leftBooked = bookedSet.has(left.user.id) ? 1 : 0;
    const rightBooked = bookedSet.has(right.user.id) ? 1 : 0;
    if (leftBooked !== rightBooked) return leftBooked - rightBooked;

    const leftScore = scoreMap.get(left.user.id)?.score ?? -1;
    const rightScore = scoreMap.get(right.user.id)?.score ?? -1;
    return rightScore - leftScore;
  });

  function handleSelect(userId: string) {
    if (bookedSet.has(userId)) return;
    onSelect(userId);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start" sideOffset={4}>
        <Command>
          <CommandInput placeholder="Найти сотрудника" />
          <CommandList>
            <CommandEmpty>Сотрудники не найдены</CommandEmpty>
            <CommandGroup>
              {shiftId && scoresLoading && (
                <div className="flex items-center justify-center gap-2 py-2 text-xs text-muted-foreground">
                  <Loader2 className="size-3 animate-spin" />
                  Подбираем сотрудников…
                </div>
              )}

              {sortedEmployees.map((employee) => {
                const isBooked = bookedSet.has(employee.user.id);
                const scoreData = scoreMap.get(employee.user.id);

                return (
                  <CommandItem
                    key={employee.id}
                    value={`${employee.user.firstName} ${employee.user.lastName} ${employee.user.nickname ?? ""}`}
                    onSelect={() => handleSelect(employee.user.id)}
                    disabled={isBooked}
                    className={cn(isBooked && "opacity-50")}
                  >
                    <Avatar size="sm">
                      <AvatarFallback className="text-[9px]">
                        {getInitials(
                          employee.user.firstName,
                          employee.user.lastName
                        )}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm">
                      {employee.user.firstName} {employee.user.lastName}
                    </span>

                    {isBooked ? (
                      <span className="flex items-center gap-1 text-xs text-green-700">
                        <Check className="size-3.5" />
                        Уже назначен
                      </span>
                    ) : scoreData ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className={cn(
                                "cursor-help gap-0.5 px-1.5 py-0 text-[10px]",
                                getScoreColor(scoreData.score)
                              )}
                            >
                              <Star className="size-2.5" />
                              {scoreData.score}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent
                            side="left"
                            className="whitespace-pre text-[11px] leading-relaxed"
                          >
                            {formatBreakdown(scoreData.breakdown)}
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "px-1.5 py-0 text-[10px]",
                          ROLE_COLORS[employee.role]
                        )}
                      >
                        {ROLE_LABELS[employee.role] ?? "Сотрудник"}
                      </Badge>
                    )}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
