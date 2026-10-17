import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "katex/dist/katex.min.css";
import "./globals.css";
import { Providers } from "@/components/providers";

// Inter поддерживает кириллицу (прежний Outfit — нет, и русский текст падал в системный шрифт)
const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "StudyHub", template: "%s · StudyHub" },
  description: "Предметы, вопросы, задачи и календарь для подготовки к сессии",
  appleWebApp: { capable: true, title: "StudyHub", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8f8fa" },
    { media: "(prefers-color-scheme: dark)", color: "#0d0d12" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
