import "server-only";
import { cookies } from "next/headers";
import { type Locale, LOCALES, DEFAULT_LOCALE, COOKIE_NAME, makeT } from "./i18n";

export async function getLocale(): Promise<Locale> {
  const c = await cookies();
  const v = c.get(COOKIE_NAME)?.value;
  return (v && LOCALES.includes(v as Locale)) ? (v as Locale) : DEFAULT_LOCALE;
}

export async function getServerT() {
  const locale = await getLocale();
  return { locale, t: makeT(locale) };
}
