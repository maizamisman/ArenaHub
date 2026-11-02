import { en, type Dict } from "./en";
import { bm } from "./bm";

export type Lang = "en" | "bm";
export const LANG_COOKIE = "ah_lang";
export type { Dict };

export function dict(lang: Lang): Dict {
  return lang === "bm" ? bm : en;
}

const ROUNDS_BM: Record<string, string> = {
  Final: "Akhir", "Semi-final": "Separuh akhir", "Semi-finals": "Separuh akhir", "Quarter-final": "Suku akhir", "Quarter-finals": "Suku akhir",
  "Third place": "Tempat ketiga", "Group stage": "Peringkat kumpulan", "Round of 16": "Pusingan 16",
};

/** Round names such as "Semi-final 2" in the chosen language. */
export function roundName(round: string, lang: Lang): string {
  if (lang !== "bm") return round;
  const m = /^(.*?)(\s+\d+)?$/.exec(round)!;
  const base = ROUNDS_BM[m[1]];
  return base ? base + (m[2] ?? "") : round;
}

/** Column heading for a bracket round, from one of its match round names. */
export function roundGroupName(round: string, lang: Lang): string {
  const base = round.replace(/\s+\d+$/, "");
  const plural = base === "Quarter-final" ? "Quarter-finals" : base === "Semi-final" ? "Semi-finals" : base;
  return roundName(plural, lang);
}

export const pick = (lang: Lang, x: { name: string; name_bm: string }) => (lang === "bm" ? x.name_bm || x.name : x.name);

const TZ = "Asia/Kuala_Lumpur";
export const fmtTime = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
export const fmtDayNum = (iso: string) => new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric" }).format(new Date(iso));
export const fmtDay = (iso: string, lang: Lang) => `${fmtDayNum(iso)} ${dict(lang).month}`;
export const fmtDayLong = (iso: string, lang: Lang) =>
  new Intl.DateTimeFormat(lang === "bm" ? "ms-MY" : "en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(iso));
export const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));

/** Google Maps directions to a court, built from its coordinates. */
export const directionsUrl = (lat: number, lng: number) => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

/** ISO time → "YYYY-MM-DDTHH:mm" in Malaysia time, for datetime-local inputs. */
export const toMytInput = (iso: string) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}T${p.hour === "24" ? "00" : p.hour}:${p.minute}`;
};
