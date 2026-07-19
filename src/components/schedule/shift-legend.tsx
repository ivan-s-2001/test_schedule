"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
      className="inline-flex min-h-7 items-center gap-2 rounded-md border px-2.5 py-1 text-sm font-semibold leading-none shadow-none [background-color:var(--user-color-light-bg)] [border-color:var(--user-color-light-border)] [color:var(--user-color-light-text)] dark:[background-color:var(--user-color-dark-bg)] dark:[border-color:var(--user-color-dark-border)] dark:[color:var(--user-color-dark-text)]"
      style={getThemeColorStyle(variant.color, variant.textColor)}
    >
      <span>{name}</span>
      <span
        className="border-l pl-2 text-xs font-medium tabular-nums"
        style={{ borderColor: "currentColor", opacity: 0.86 }}
      >
        {variant.label}
      </span>
    </span>
  );
}

function SystemLegendItem({
  badge,
  description,
}: {
  badge: React.ReactNode;
  description: string;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 text-sm">
      {badge}
      <span className="font-medium text-muted-foreground" aria-hidden="true">
        —
      </span>
      <span className="text-secondary-foreground">{description}</span>
    </div>
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
    <details className="rounded-lg border border-border bg-card" open>
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-foreground">
        Обозначения
      </summary>

      <div className="space-y-3 border-t border-border px-4 py-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Загрузка…
          </div>
        ) : (
          <>
            <div className="space-y-2.5">
              {groups.map((group) => (
                <div
                  key={group.key}
                  className="flex min-w-0 flex-wrap items-center gap-2"
                >
                  <div className="flex flex-wrap gap-1.5">
                    {group.variants.map((variant) => (
                      <ShiftBadge
                        key={variant.id}
                        name={group.name}
                        variant={variant}
                      />
                    ))}
                  </div>

                  <span
                    className="font-medium text-muted-foreground"
                    aria-hidden="true"
                  >
                    —
                  </span>
                  <span className="min-w-0 text-sm leading-5 text-secondary-foreground">
                    {group.description ?? "Обычная рабочая смена"}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid gap-2 border-t border-border pt-3 md:grid-cols-2 xl:grid-cols-3">
              <SystemLegendItem
                badge={
                  <span className="inline-flex min-h-7 min-w-9 items-center justify-center rounded-md border border-input bg-background px-2 text-sm font-semibold text-foreground">
                    −
                  </span>
                }
                description="Выходной сотрудника"
              />
              <SystemLegendItem
                badge={
                  <span className="inline-flex min-h-7 items-center rounded-md border border-input bg-background px-2.5 text-sm font-semibold text-foreground">
                    Отпуск
                  </span>
                }
                description="Период отпуска"
              />
              <SystemLegendItem
                badge={
                  <span className="inline-flex min-h-7 items-center rounded-md border border-destructive/35 bg-destructive/10 px-2.5 text-sm font-semibold text-destructive">
                    Больничный
                  </span>
                }
                description="Период больничного"
              />
              <SystemLegendItem
                badge={
                  <span className="inline-flex min-h-7 items-center rounded-md bg-foreground px-2.5 text-sm font-semibold text-background">
                    П +N ч
                  </span>
                }
                description="Сумма переработки до и после смены"
              />
              <SystemLegendItem
                badge={
                  <span className="inline-flex min-h-7 items-center rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                    Зелёный фон
                  </span>
                }
                description="Суббота, воскресенье или официальный нерабочий день РФ"
              />
            </div>
          </>
        )}
      </div>
    </details>
  );
}
