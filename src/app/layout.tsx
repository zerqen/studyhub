import type { Metadata } from "next";
import { Outfit, Literata } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const outfit = Outfit({ subsets: ["latin", "latin-ext"], variable: "--font-outfit" });
const literata = Literata({ subsets: ["latin"], variable: "--font-literata" });

export const metadata: Metadata = {
  title: "StudyHub — подготовка к сессии",
  description: "Предметы, вопросы, задачи и календарь для студента",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body className={`${outfit.variable} ${literata.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
