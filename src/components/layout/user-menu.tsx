"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Check, Languages, Loader2, LogOut } from "lucide-react";
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
import type { AppLocale } from "@/i18n/routing";

export function UserMenu() {
  const { data: member } = useCurrentMember();
  const locale = useLocale();
  const tLocale = useTranslations("locale");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const [changingLocale, setChangingLocale] = useState<AppLocale | null>(null);

  const firstName = member?.user.firstName ?? "";
  const lastName = member?.user.lastName ?? "";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  const fullName = `${firstName} ${lastName}`.trim();

  async function changeLocale(nextLocale: AppLocale) {
    if (nextLocale === locale || changingLocale) return;

    setChangingLocale(nextLocale);
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });

      if (!response.ok) {
        throw new Error("Could not change locale");
      }

      router.refresh();
    } finally {
      setChangingLocale(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 gap-2 px-2">
          <Avatar size="sm">
            {member?.user.profileImage && (
              <AvatarImage src={member.user.profileImage} alt={fullName} />
            )}
            <AvatarFallback className="bg-slate-200 text-slate-800">
              {initials || "?"}
            </AvatarFallback>
          </Avatar>
          <span className="hidden text-sm font-medium lg:inline">
            {fullName || tCommon("loading")}
          </span>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium">{fullName}</p>
            {member?.organizationName && (
              <p className="text-xs text-muted-foreground">
                {member.organizationName}
              </p>
            )}
            {member?.user.email && (
              <p className="truncate text-xs text-muted-foreground">
                {member.user.email}
              </p>
            )}
          </div>
        </DropdownMenuLabel>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="flex items-center gap-2 text-xs text-muted-foreground">
          <Languages className="size-3.5" />
          {tLocale("language")}
        </DropdownMenuLabel>

        <DropdownMenuItem
          onClick={() => changeLocale("ru")}
          disabled={Boolean(changingLocale)}
        >
          <span className="flex-1">{tLocale("russian")}</span>
          {changingLocale === "ru" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : locale === "ru" ? (
            <Check className="size-4" />
          ) : null}
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => changeLocale("en")}
          disabled={Boolean(changingLocale)}
        >
          <span className="flex-1">{tLocale("english")}</span>
          {changingLocale === "en" ? (
            <Loader2 className="size-4 animate-spin" />
          ) : locale === "en" ? (
            <Check className="size-4" />
          ) : null}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/" })}
          variant="destructive"
        >
          <LogOut className="mr-2 size-4" />
          {tAuth("logout")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
