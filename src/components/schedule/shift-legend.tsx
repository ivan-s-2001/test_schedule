"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
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

function ShiftBadge({
  name,
  variant,
}: {
  name: string;
  variant: ShiftTemplate;
}) {
  const whiteBackground = variant.color.toUpperCase() === "#FFFFFF";

  return (
    <span
      className="inline-flex min-h-7 items-center gap-2 rounded-md border px-2.5 py-1 text-sm font-semibold leading-none shadow-[0_1px_1px_rgba(0,0,0,0.08)]"
      style={{
        backgroundColor: variant.color,
        color: variant.textColor,
        borderColor: whiteBackground ? "#A2B2C3" : "rgba(17, 19, 25, 0.28)",
      }}
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
      <span className="font-medium text-[#66778F]" aria-hidden="true">
        —
      </span>
      <span className="text-[#2F3336]">{description}</span>
    </div>
  );
}

export function ShiftLegend() {
  const t = useTranslations("schedule.legend");
  const tGrid = useTranslations("schedule.grid");
  const tEditor = useTranslations("schedule.editor");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");

  const { data, isLoading } = useQuery<ShiftPoolResponse>({
    queryKey: ["shift-pool"],
    queryFn: async () => {
      const response = await fetch("/api/shift-pool");
      if (!response.ok) throw new Error(tErrors("loadSchedule"));
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
    <details className="rounded-lg border border-[#DAE1E9] bg-white" open>
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-semibold text-[#111319]">
        {t("title")}
      </summary>

      <div className="space-y-3 border-t border-[#DAE1E9] px-4 py-4">
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-[#4E5C6E]">
            <Loader2 className="size-4 animate-spin" />
            {tCommon("loading")}
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
                    className="font-medium text-[#66778F]"
                    aria-hidden="true"
                  >
                    —
                  </span>
                  <span className="min-w-0 text-sm leading-5 text-[#2F3336]">
                    {group.description ?? tEditor("shift")}
                  </span>
                </div>
              ))}
            </div>

            <div className="grid gap-2 border-t border-[#DAE1E9] pt-3 md:grid-cols-2 xl:grid-cols-3">
              <SystemLegendItem
                badge={
                  <span className="inline-flex min-h-7 min-w-9 items-center justify-center rounded-md border border-[#A2B2C3] bg-white px-2 text-sm font-semibold text-[#111319]">
                    −
                  </span>
                }
                description={t("dayOff")}
              />
              <SystemLegendItem
                badge={
                  <span className="inline-flex min-h-7 items-center rounded-md border border-[#A2B2C3] bg-white px-2.5 text-sm font-semibold text-[#111319]">
                    {tGrid("vacation")}
                  </span>
                }
                description={t("vacation")}
              />
              <SystemLegendItem
                badge={
                  <span className="inline-flex min-h-7 items-center rounded-md border border-[#F5A3B5] bg-[#FFF1F4] px-2.5 text-sm font-semibold text-[#A40E32]">
                    {tGrid("sickLeave")}
                  </span>
                }
                description={t("sickLeave")}
              />
              <SystemLegendItem
                badge={
                  <span className="inline-flex min-h-7 items-center rounded-md bg-[#111319] px-2.5 text-sm font-semibold text-white">
                    {tGrid("overtimeBadge", { hours: "N" })}
                  </span>
                }
                description={t("overtime")}
              />
              <SystemLegendItem
                badge={
                  <span className="inline-flex size-7 items-center justify-center rounded-md border border-[#9BC9A9] bg-[#E8F5EC] text-sm font-semibold text-[#216E39]">
                    ■
                  </span>
                }
                description={t("calendarDayOff")}
              />
            </div>
          </>
        )}
      </div>
    </details>
  );
}
