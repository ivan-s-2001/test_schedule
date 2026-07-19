"use client";

import { signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { ChevronUp, LogOut, Moon, Sun } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useCurrentMember } from "@/lib/hooks/use-current-member";
import { cn } from "@/lib/utils";

const roleNames: Record<string, string> = {
  OWNER: "Владелец",
  ADMIN: "Администратор",
  MANAGER: "Руководитель",
  EMPLOYEE: "Сотрудник",
};

export function UserMenu({
  className,
  showName = true,
}: {
  className?: string;
  showName?: boolean;
}) {
  const { data: member } = useCurrentMember();
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  const firstName = member?.user.firstName ?? "";
  const lastName = member?.user.lastName ?? "";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const fullName = `${firstName} ${lastName}`.trim();
  const roleName = member?.role ? roleNames[member.role] ?? member.role : "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className={cn(
            "h-10 min-w-0 gap-2 px-2 text-left font-normal",
            showName ? "justify-start" : "w-9 px-0",
            className
          )}
        >
          <Avatar size="sm" className="shrink-0">
            {member?.user.profileImage && (
              <AvatarImage src={member.user.profileImage} alt={fullName} />
            )}
            <AvatarFallback className="bg-[var(--accent-soft)] text-[var(--accent-strong)]">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>

          {showName && (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-medium leading-4 text-sidebar-accent-foreground">
                  {fullName || "Загрузка..."}
                </span>
                <span className="block truncate text-[11px] leading-4 text-sidebar-foreground">
                  {roleName || member?.organizationName || "QuickTickets"}
                </span>
              </span>
              <ChevronUp className="size-3.5 shrink-0 text-sidebar-foreground" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className="w-64">
        <DropdownMenuLabel className="font-normal">
          <div className="flex items-center gap-3">
            <Avatar size="default">
              {member?.user.profileImage && (
                <AvatarImage src={member.user.profileImage} alt={fullName} />
              )}
              <AvatarFallback className="bg-[var(--accent-soft)] text-[var(--accent-strong)]">
                {initials || "?"}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {fullName || "Пользователь"}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {member?.user.email || roleName}
              </p>
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setTheme(isDark ? "light" : "dark")}>
          {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
          {isDark ? "Светлая тема" : "Тёмная тема"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/login" })}
          variant="destructive"
        >
          <LogOut className="size-4" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
