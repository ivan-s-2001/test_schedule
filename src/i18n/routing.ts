import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ru", "en"],
  defaultLocale: "ru",
  localePrefix: "never",
});

export const LOCALE_COOKIE = "APP_LOCALE";
export type AppLocale = (typeof routing.locales)[number];
