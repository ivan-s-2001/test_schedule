import type { ComponentType } from "react";
import type { OutlineIconProps } from "@/components/icons/outline-icons";
import {
  CalendarIcon,
  ClockIcon,
  TeamIcon,
  CommentIcon,
  GraphIcon,
  SettingsIcon,
  SparklesIcon,
} from "@/components/icons/outline-icons";

export type NavigationItem = {
  key: string;
  href: string;
  label: string;
  icon: ComponentType<OutlineIconProps>;
};

export type NavigationGroup = {
  label: string;
  items: readonly NavigationItem[];
};

export const navigationGroups: readonly NavigationGroup[] = [
  {
    label: "Работа",
    items: [
      {
        key: "schedule",
        href: "/schedule/employee",
        label: "График",
        icon: CalendarIcon,
      },
      {
        key: "time",
        href: "/time",
        label: "Учёт времени",
        icon: ClockIcon,
      },
      {
        key: "portal",
        href: "/portal/inbox",
        label: "Портал",
        icon: CommentIcon,
      },
    ],
  },
  {
    label: "Организация",
    items: [
      {
        key: "employees",
        href: "/employees",
        label: "Сотрудники",
        icon: TeamIcon,
      },
      {
        key: "reporting",
        href: "/reporting",
        label: "Отчёты",
        icon: GraphIcon,
      },
    ],
  },
] as const;

export const utilityNavigationItems: readonly NavigationItem[] = [
  {
    key: "ai",
    href: "/ai/chat",
    label: "ИИ-ассистент",
    icon: SparklesIcon,
  },
  {
    key: "settings",
    href: "/settings",
    label: "Настройки",
    icon: SettingsIcon,
  },
] as const;

export function isNavigationItemActive(pathname: string, href: string) {
  const rootSegment = `/${href.split("/")[1]}`;
  return pathname === href || pathname.startsWith(`${rootSegment}/`) || pathname === rootSegment;
}
