import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "NOTEFORM - GPT 정리본 PDF 변환",
  description: "GPT 강의 정리본과 LaTeX 수식을 인쇄용 A4 PDF로 자동 변환합니다.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#171717" };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
