import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "모아타임 · 개인과 팀을 위한 일정 예약",
  description: "예약 링크 하나로 서로에게 딱 맞는 시간을 만나세요. 개인과 팀을 위한 Google 기반 일정 예약 서비스.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className="antialiased">{children}</body>
    </html>
  );
}
