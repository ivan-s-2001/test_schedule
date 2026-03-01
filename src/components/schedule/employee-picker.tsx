"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
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

interface EmployeePickerProps {
  /** IDs of users already booked in this shift */
  bookedUserIds: string[];
  /** Called when an employee is selected */
  onSelect: (userId: string) => void;
  children: React.ReactNode;
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  OWNER: "Inhaber",
  ADMIN: "Admin",
  MANAGER: "Manager",
  EMPLOYEE: "MA",
};

const ROLE_COLORS: Record<string, string> = {
  OWNER: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  ADMIN: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  MANAGER: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  EMPLOYEE: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
};

export function EmployeePicker({
  bookedUserIds,
  onSelect,
  children,
}: EmployeePickerProps) {
  const [open, setOpen] = useState(false);

  // Fetch all active org employees
  const { data } = useQuery<{ members: OrgEmployee[] }>({
    queryKey: ["employees", "active"],
    queryFn: async () => {
      const res = await fetch("/api/employees?status=active");
      if (!res.ok) throw new Error("Fehler beim Laden der Mitarbeiter");
      return res.json();
    },
    enabled: open,
  });

  const employees = data?.members ?? [];
  const bookedSet = new Set(bookedUserIds);

  function handleSelect(userId: string) {
    if (bookedSet.has(userId)) return;
    onSelect(userId);
    setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start" sideOffset={4}>
        <Command>
          <CommandInput placeholder="Mitarbeiter suchen..." />
          <CommandList>
            <CommandEmpty>Keine Mitarbeiter gefunden</CommandEmpty>
            <CommandGroup>
              {employees.map((emp) => {
                const isBooked = bookedSet.has(emp.user.id);
                return (
                  <CommandItem
                    key={emp.id}
                    value={`${emp.user.firstName} ${emp.user.lastName} ${emp.user.nickname ?? ""}`}
                    onSelect={() => handleSelect(emp.user.id)}
                    disabled={isBooked}
                    className={cn(isBooked && "opacity-50")}
                  >
                    <Avatar size="sm">
                      <AvatarFallback className="text-[9px]">
                        {getInitials(emp.user.firstName, emp.user.lastName)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm">
                      {emp.user.firstName} {emp.user.lastName}
                    </span>
                    {isBooked ? (
                      <Check className="size-3.5 text-green-600" />
                    ) : (
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[9px] px-1.5 py-0",
                          ROLE_COLORS[emp.role]
                        )}
                      >
                        {ROLE_LABELS[emp.role] ?? emp.role}
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
