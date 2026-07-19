import { NextResponse } from "next/server";
import { LOCALE_COOKIE } from "@/i18n/request";
import { routing, type AppLocale } from "@/i18n/routing";

function isAppLocale(value: unknown): value is AppLocale {
  return (
    typeof value === "string" &&
    routing.locales.includes(value as AppLocale)
  );
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400 }
    );
  }

  const locale =
    typeof body === "object" && body !== null && "locale" in body
      ? (body as { locale?: unknown }).locale
      : undefined;

  if (!isAppLocale(locale)) {
    return NextResponse.json(
      { error: "Unsupported locale" },
      { status: 400 }
    );
  }

  const response = NextResponse.json({ locale });
  response.cookies.set(LOCALE_COOKIE, locale, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 365,
  });

  return response;
}
