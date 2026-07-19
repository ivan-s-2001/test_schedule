"use client";

import { useState } from "react";
import { useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AppLocale } from "@/i18n/routing";

const locales: AppLocale[] = ["ru", "en"];

export function LocaleSwitcher() {
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [pendingLocale, setPendingLocale] = useState<AppLocale | null>(null);

  async function changeLocale(nextLocale: AppLocale) {
    if (nextLocale === locale || pendingLocale) return;

    setPendingLocale(nextLocale);
    try {
      const response = await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: nextLocale }),
      });

      if (!response.ok) throw new Error("Could not change locale");
      router.refresh();
    } finally {
      setPendingLocale(null);
    }
  }

  return (
    <div className="ml-auto flex items-center rounded-sm border border-[#c9d3df] bg-white/70 p-0.5">
      {locales.map((item) => (
        <button
          key={item}
          type="button"
          onClick={() => changeLocale(item)}
          disabled={Boolean(pendingLocale)}
          className={cn(
            "flex h-7 min-w-9 items-center justify-center rounded-[3px] px-2 text-xs font-semibold uppercase transition-colors",
            item === locale
              ? "bg-[#cdd8e5] text-[#111319]"
              : "text-[#5b6778] hover:bg-[#e4eaf0] hover:text-[#111319]"
          )}
          aria-label={item === "ru" ? "Русский" : "English"}
        >
          {pendingLocale === item ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            item
          )}
        </button>
      ))}
    </div>
  );
}
