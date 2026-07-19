"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, Loader2 } from "lucide-react";
import type { ShiftTemplate } from "@/lib/schedule/shift-pool";
import { getThemeColorStyle } from "@/lib/utils/theme-color";

 type ShiftPoolResponse = {
  templates: ShiftTemplate[];
};

type LegendGroup = {
  key: string;
  name: string;
  description: string | null;
  variants: ShiftTemplate[];
};

function ShiftBadge({
  name,
  variant,
}: {
  name: string;
  variant: ShiftTemplate;
}) {
  return (
    <span
      className="inline-flex min-h-6 items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-semibold leading-none [background-color:var(--user-color-light-bg)] [border-color:var(--user-color-light-border)] [color:var(--user-color-light-text)] dark:[background-color:var(--user-color-dark-bg)] dark:[border-color:var(--user-color-dark-border)] dark:[color:var(--user-color-dark-text)]"
      style={getThemeColorStyle(variant.color, variant.textColor)}
    >
      <span>{name}</span>
      <span
        className="border-l pl-1.5 font-medium tabular-nums opacity-80"
        style={{ borderColor: "currentColor" }}
      >
        {variant.label}
      </span>
    </span>
  );
}

function SystemBadge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "danger" | "success" | "dark";
}) {
  const classes = {
    neutral: "border-border bg-background text-foreground",
    danger: "border-destructive/35 bg-destructive/10 text-destructive",
    success:
      "border-[color-mix(in_srgb,var(--outline-success)_40%,transparent)] bg-[color-mix(in_srgb,var(--outline-success)_12%,transparent)] text-[var(--outline-success)]",
    dark: "border-transparent bg-foreground text-background",
  }[tone];

  return (
    <span
      className={`inline-flex min-h-6 items-center rounded-md border px-2 text-xs font-semibold ${classes}`}
    >
      {children}
    </span>
  );
}

export function ShiftLegend() {
  const { data, isLoading } = useQuery<ShiftPoolResponse>({
    queryKey: ["shift-pool"],
    queryFn: async () => {
      const response = await fetch("/api/shift-pool");
      if (!response.ok) throw new Error("Не удалось загрузить обозначения");
      return response.json();
    },
  });

  const groups = useMemo<LegendGroup[]>(() => {
    const result = new Map<string, LegendGroup>();

    for (const template of data?.templates ?? []) {
      const name = template.name.trim();
      const description = template.description?.trim() || null;
      const key = `${name}\u0000${description ?? ""}`;
      const group = result.get(key) ?? {
        key,
        name,
        description,
        variants: [],
      };

      group.variants.push(template);
      result.set(key, group);
    }

    return [...result.values()];
  }, [data?.templates]);

  return (
    <details className="group" open>
      <summary className="flex cursor-pointer list-none items-center gap-2 text-xs font-semibold text-muted-foreground marker:hidden">
        <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" />
        Обозначения смен
      </summary>

      <div className="mt-2.5 space-y-3">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Загрузка…
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-5 gap-y-2.5">
              {groups.map((group) => (
                <div key={group.key} className="flex min-w-0 items-center gap-2">
                  <div className="flex flex-wrap gap-1">
                    {group.variants.map((variant) => (
                      <ShiftBadge
                        key={variant.id}
                        name={group.name}
                        variant={variant}
                      />
                    ))}
                  </div>
                  {group.description && (
                    <span className="hidden max-w-64 truncate text-xs text-muted-foreground xl:inline">
                      {group.description}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-2.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <SystemBadge>−</SystemBadge> выходной
              </span>
              <span className="flex items-center gap-1.5">
                <SystemBadge>Отпуск</SystemBadge> отпуск
              </span>
              <span className="flex items-center gap-1.5">
                <SystemBadge tone="danger">Больничный</SystemBadge> больничный
              </span>
              <span className="flex items-center gap-1.5">
                <SystemBadge tone="dark">П +N ч</SystemBadge> переработка
              </span>
              <span className="flex items-center gap-1.5">
                <SystemBadge tone="success">Нерабочий</SystemBadge> выходной или праздник
              </span>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
