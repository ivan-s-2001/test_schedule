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
  { key: "schedule", label: "График смен", icon: Calendar },
  { key: "time", label: "Учёт времени", icon: Clock },
  { key: "wishplan", label: "Пожелания по сменам", icon: FileHeart },
  { key: "employees", label: "Сотрудники", icon: Users },
  { key: "absences", label: "Отсутствия", icon: Umbrella },
  { key: "account", label: "Организация", icon: Building2 },
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
    <aside className="w-60 shrink-0 border-r border-border pr-5">
      <nav aria-label="Разделы настроек">
        <h3 className="mb-2 px-2.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
          Настройки
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
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-sm font-medium transition-colors",
                    active
                      ? "bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                      : "text-muted-foreground hover:bg-[var(--accent-subtle)] hover:text-foreground"
                  )}
                >
                  <Icon className="size-[17px] shrink-0" />
                  <span className="truncate">{section.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </aside>
  );
}
