import ru from "../../messages/ru.json";

export {};

declare module "next-intl" {
  interface AppConfig {
    Locale: "ru" | "en";
    Messages: typeof ru;
  }
}
