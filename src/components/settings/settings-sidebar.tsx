"use client";

import {
  Calendar,
  Clock,
  FileHeart,
  Users,
  Umbrella,
  Building2,
} from "lucide-react";
import { cn } from "@/lib/utils";

const sections = [
  {
    key: "schedule",
    label: "График смен",
    icon: Calendar,
  },
  {
    key: "time",
    label: "Учёт времени",
    icon: Clock,
  },
  {
    key: "wishplan",
    label: "Пожелания по сменам",
    icon: FileHeart,
  },
  {
    key: "employees",
    label: "Сотрудники",
    icon: Users,
  },
  {
    key: "absences",
    label: "Отсутствия",
    icon: Umbrella,
  },
  {
    key: "account",
    label: "Учётная запись",
    icon: Building2,
  },
] as const;

export type SettingsSection = (typeof sections)[number]["key"];

interface SettingsSidebarProps {
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

export function SettingsSidebar({
  activeSection,
  onSectionChange,
}: SettingsSidebarProps) {
  return (
    <aside className="w-56 shrink-0">
      <nav>
        <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          Einstellungen
        </h3>
        <ul className="space-y-0.5">
          {sections.map((section) => {
            const Icon = section.icon;
            const active = activeSection === section.key;
            return (
              <li key={section.key}>
                <button
                  type="button"
                  onClick={() => onSectionChange(section.key)}
                  className={cn(
                    "flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    active
                      ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <Icon className="size-4" />
                  <span>{section.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
