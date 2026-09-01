import type { Metadata } from "next";
import { IBM_Plex_Sans_KR, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

/*
  한글 폰트는 유니코드 범위별로 190여 개 서브셋으로 쪼개진다.
  preload 를 켜두면 그걸 전부 미리 받으려 해서 초기 로딩이 느려지고
  브라우저가 "preload 했는데 안 썼다" 경고를 그만큼 쏟는다.
  필요한 서브셋만 필요할 때 받게 한다. display: swap 이라 깜빡임도 짧다.
*/
const plexKr = IBM_Plex_Sans_KR({
  variable: "--font-plex-kr",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
  fallback: ["Malgun Gothic", "Apple SD Gothic Neo", "system-ui", "sans-serif"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
  fallback: ["ui-monospace", "monospace"],
});

export const metadata: Metadata = {
  title: "carein — 돌봄 재무 내비게이터",
  description:
    "부모 돌봄이 시작되면 흩어진 제도를 찾아 조합하고, 앞으로 10년의 비용과 결정을 계산합니다.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={`${plexKr.variable} ${plexMono.variable}`}>{children}</body>
    </html>
  );
}
