import type { Metadata } from "next";
import "./globals.css";
import "./availability.css";
import "./editor.css";
import {siteUrl} from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "모아타임 · Google 캘린더 기반 일정 예약",
  description: "예약 링크 하나로 서로에게 딱 맞는 시간을 만나세요. 1:1 예약부터 여러 명 일정 투표까지, Google 캘린더 기반 일정 예약 서비스.",
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
