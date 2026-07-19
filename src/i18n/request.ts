import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import {
  LOCALE_COOKIE,
  routing,
  type AppLocale,
} from "./routing";

function isAppLocale(value: string | undefined): value is AppLocale {
  return Boolean(value && routing.locales.includes(value as AppLocale));
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(LOCALE_COOKIE)?.value;
  const locale = isAppLocale(cookieLocale)
    ? cookieLocale
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
