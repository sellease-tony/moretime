import type { Metadata } from "next";
import "./globals.css";
import "./availability.css";
import "./editor.css";
import "./mobile.css";
import {siteUrl} from '@/lib/site';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "모아타임 · Google·Outlook 캘린더 일정 예약",
  description: "예약 링크 하나로 서로에게 딱 맞는 시간을 만나세요. 1:1 예약부터 여러 명 일정 투표까지, Google·Outlook 캘린더와 연결하는 일정 예약 서비스.",
  // Search engines need a raster icon in multiples of 48px; the SVG stays for browsers that use it.
  icons: {
    icon: [{url:"/favicon.svg",type:"image/svg+xml"},{url:"/icon-48.png",sizes:"48x48",type:"image/png"},{url:"/icon-192.png",sizes:"192x192",type:"image/png"}],
    shortcut: "/icon-48.png",
    apple: "/apple-touch-icon.png",
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
