import type { Metadata, Viewport } from "next";
import { Anton, Archivo } from "next/font/google";
import { cookies } from "next/headers";
import "./globals.css";

const anton = Anton({ weight: "400", subsets: ["latin"], variable: "--font-anton", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], style: ["normal", "italic"], variable: "--font-archivo", display: "swap" });

export const metadata: Metadata = {
  title: "ArenaHub",
  description: "Live scores, standings and schedule for Karnival Sukan KD Sri Klang 2027.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#071B3A" };

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const lang = (await cookies()).get("ah_lang")?.value === "bm" ? "ms" : "en";
  return (
    <html lang={lang} className={`${anton.variable} ${archivo.variable}`}>
      <body>{children}</body>
    </html>
  );
}
