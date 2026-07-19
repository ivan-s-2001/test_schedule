"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { useCurrentMember } from "@/lib/hooks/use-current-member";
import {
  SettingsSidebar,
  type SettingsSection,
} from "@/components/settings/settings-sidebar";
import { ScheduleSettings } from "@/components/settings/schedule-settings";
import { TimeSettings } from "@/components/settings/time-settings";
import { AbsenceSettings } from "@/components/settings/absence-settings";
import { AccountSettings } from "@/components/settings/account-settings";

type SettingsResponse = {
  organization: {
    id: string;
    name: string;
    address: string | null;
    nameFormat: string;
    scheduleVisibility: string;
  };
  timeSettings: {
    whoCanUse: string;
    watchAutoStop: boolean;
    warningsEnabled: boolean;
    warningsMaxHours: number;
    useCategories: boolean;
  };
  absenceCategories: {
    id: string;
    name: string;
    color: string;
    isPaid: boolean;
  }[];
  holidays: {
    id: string;
    name: string;
    date: string;
    country: string;
    state: string | null;
  }[];
  orgSettings: {
    aiEnabled: boolean;
    smsEnabled: boolean;
  };
};

const mobileSections: { value: SettingsSection; label: string }[] = [
  { value: "schedule", label: "График смен" },
  { value: "time", label: "Учёт времени" },
  { value: "wishplan", label: "Пожелания по сменам" },
  { value: "employees", label: "Сотрудники" },
  { value: "absences", label: "Отсутствия" },
  { value: "account", label: "Организация" },
];

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const { data: currentMember, isLoading: memberLoading } = useCurrentMember();
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("schedule");
  const isAdmin =
    currentMember?.role === "OWNER" || currentMember?.role === "ADMIN";

  const { data, isLoading, error } = useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: async () => {
      const response = await fetch("/api/settings");
      if (!response.ok) throw new Error("Ошибка загрузки настроек");
      return response.json();
    },
    enabled: isAdmin,
  });

  const updateMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const response = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const responseData = await response.json();
        throw new Error(responseData.error || "Ошибка сохранения");
      }
      return response.json();
    },
    onSuccess: () => {
      toast.success("Настройки сохранены");
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
    onError: (mutationError: Error) => {
      toast.error(mutationError.message);
    },
  });

  function handleUpdate(value: Record<string, unknown>) {
    updateMutation.mutate(value);
  }

  if (memberLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
        <span className="grid size-12 place-items-center rounded-full bg-[var(--accent-subtle)] text-muted-foreground">
          <ShieldAlert className="size-6" />
        </span>
        <h2 className="text-lg font-semibold">Доступ запрещён</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Изменять настройки могут только администраторы и владелец организации.
        </p>
      </div>
    );
  }

  const holidayCountry =
    data && data.holidays.length > 0 ? data.holidays[0].country : "DE";
  const holidayState =
    data && data.holidays.length > 0 ? data.holidays[0].state ?? "" : "";

  return (
    <div className="space-y-5">
      <header className="border-b border-border pb-5">
        <h1>Настройки</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Параметры организации, графика и учёта времени
        </p>
      </header>

      <div className="md:hidden">
        <label htmlFor="settings-section" className="sr-only">
          Раздел настроек
        </label>
        <select
          id="settings-section"
          value={activeSection}
          onChange={(event) =>
            setActiveSection(event.target.value as SettingsSection)
          }
          className="h-9 w-full rounded-md border border-input bg-[var(--outline-input-background)] px-3 text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-[var(--accent-soft)]"
        >
          {mobileSections.map((section) => (
            <option key={section.value} value={section.value}>
              {section.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-start gap-7">
        <div className="hidden md:block">
          <SettingsSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
          />
        </div>

        <section className="min-w-0 flex-1">
          {isLoading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && (error || !data) && (
            <Card className="p-6 text-center text-destructive">
              Не удалось загрузить настройки. Повторите попытку.
            </Card>
          )}

          {!isLoading && data && (
            <>
              {activeSection === "schedule" && (
                <ScheduleSettings
                  nameFormat={data.organization.nameFormat}
                  scheduleVisibility={data.organization.scheduleVisibility}
                  onUpdate={handleUpdate}
                  isSaving={updateMutation.isPending}
                />
              )}

              {activeSection === "time" && (
                <TimeSettings
                  timeSettings={data.timeSettings}
                  onUpdate={handleUpdate}
                  isSaving={updateMutation.isPending}
                />
              )}

              {activeSection === "wishplan" && (
                <EmptySettingsSection
                  title="Пожелания по сменам"
                  description="Настройки пожеланий по сменам появятся в одном из следующих обновлений."
                />
              )}

              {activeSection === "employees" && (
                <EmptySettingsSection
                  title="Сотрудники"
                  description="Дополнительные параметры сотрудников появятся в одном из следующих обновлений."
                />
              )}

              {activeSection === "absences" && (
                <AbsenceSettings
                  categories={data.absenceCategories}
                  holidayCountry={holidayCountry}
                  holidayState={holidayState}
                  onUpdateSettings={handleUpdate}
                  isSaving={updateMutation.isPending}
                />
              )}

              {activeSection === "account" && (
                <AccountSettings
                  orgName={data.organization.name}
                  orgAddress={data.organization.address ?? ""}
                  onUpdate={handleUpdate}
                  isSaving={updateMutation.isPending}
                />
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptySettingsSection({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-5">
      <div>
        <h2>{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">Настройки раздела</p>
      </div>
      <div className="rounded-lg border border-dashed border-border bg-[var(--accent-subtle)] p-10 text-center">
        <p className="text-sm font-medium">Скоро будет доступно</p>
        <p className="mx-auto mt-1 max-w-lg text-sm text-muted-foreground">
          {description}
        </p>
      </div>
    </div>
  );
}
