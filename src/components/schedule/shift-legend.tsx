"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { ShiftTemplate } from "@/lib/schedule/shift-pool";

type ShiftPoolResponse = {
  templates: ShiftTemplate[];
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

  return (
    <details className="rounded-lg border bg-white shadow-sm" open>
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-slate-900">
        Сводка обозначений
      </summary>

      <div className="border-t p-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Загрузка пула смен…
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {(data?.templates ?? []).map((template) => (
              <div
                key={template.id}
                className="rounded-md border-2 px-3 py-2"
                style={{
                  backgroundColor: template.color,
                  color: template.textColor,
                  borderColor:
                    template.color === "#FFFFFF"
                      ? "#94A3B8"
                      : template.color,
                }}
              >
                <div className="font-bold">{template.name}</div>
                <div className="text-sm font-semibold">{template.label}</div>
                {template.description && (
                  <div className="mt-1 text-xs opacity-85">
                    {template.description}
                  </div>
                )}
              </div>
            ))}

            <div className="rounded-md border-2 border-slate-300 bg-white px-3 py-2 text-slate-800">
              <div className="font-bold">− Выходной</div>
              <div className="text-xs">Выходной сотрудника, не отсутствие.</div>
            </div>

            <div className="rounded-md border-2 border-slate-400 bg-white px-3 py-2 text-slate-900">
              <div className="font-bold">Отпуск</div>
              <div className="text-xs">Объединённый период отсутствия.</div>
            </div>

            <div className="rounded-md border-2 border-red-300 bg-red-50 px-3 py-2 text-red-900">
              <div className="font-bold">Больничный</div>
              <div className="text-xs">Объединённый период отсутствия.</div>
            </div>

            <div className="rounded-md border-2 border-blue-300 bg-blue-50 px-3 py-2 text-blue-900">
              <div className="font-bold">П +N ч</div>
              <div className="text-xs">Переработка сверх назначенной смены.</div>
            </div>

            <div className="rounded-md border-2 border-emerald-200 bg-emerald-50 px-3 py-2 text-emerald-900">
              <div className="font-bold">Зелёный фон дня</div>
              <div className="text-xs">
                Суббота, воскресенье или официальный нерабочий день РФ.
              </div>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
