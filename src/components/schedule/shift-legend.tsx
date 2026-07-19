"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { ShiftTemplate } from "@/lib/schedule/shift-pool";

type ShiftPoolResponse = {
  templates: ShiftTemplate[];
};

type LegendGroup = {
  key: string;
  name: string;
  description: string | null;
  variants: ShiftTemplate[];
};

export function ShiftLegend() {
  const { data, isLoading } = useQuery<ShiftPoolResponse>({
    queryKey: ["shift-pool"],
    queryFn: async () => {
      const response = await fetch("/api/shift-pool");
      if (!response.ok) throw new Error("Не удалось загрузить легенду");
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
    <details className="rounded-md border bg-white" open>
      <summary className="cursor-pointer select-none px-3 py-2 text-xs font-semibold text-slate-700">
        Обозначения
      </summary>

      <div className="space-y-2 border-t px-3 py-2.5">
        {isLoading ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3.5 animate-spin" />
            Загрузка…
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {groups.map((group) => (
                <div key={group.key} className="min-w-0 text-xs">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-900">{group.name}</span>
                    {group.variants.map((variant) => (
                      <span
                        key={variant.id}
                        className="inline-flex items-center gap-1 rounded border bg-white px-1.5 py-0.5 font-medium text-slate-700"
                      >
                        <span
                          className="size-2.5 rounded-sm border border-black/20"
                          style={{ backgroundColor: variant.color }}
                        />
                        {variant.label}
                      </span>
                    ))}
                  </div>
                  {group.description && (
                    <div className="mt-0.5 max-w-md text-[10px] leading-tight text-slate-500">
                      {group.description}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-x-4 gap-y-1 border-t pt-2 text-[10px] text-slate-600">
              <span><b>−</b> выходной</span>
              <span><b>Отпуск</b> период отсутствия</span>
              <span><b>Больничный</b> период отсутствия</span>
              <span><b>П +N ч</b> сумма переработки до и после смены</span>
              <span><b className="text-emerald-700">Зелёный фон</b> выходной или праздник РФ</span>
            </div>
          </>
        )}
      </div>
    </details>
  );
}
