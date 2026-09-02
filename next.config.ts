import type { NextConfig } from "next";

/**
 * 보안 헤더
 *
 * 이 앱은 런타임에 외부 리소스를 하나도 안 부른다. 폰트는 next/font 가 self-host 하고,
 * 이미지도 없고, 모델 호출은 전부 서버에서 나간다. 그래서 default-src 를 'self' 로
 * 조여도 깨지는 게 없다.
 *
 * 'unsafe-inline' 두 곳은 남긴다.
 *   script — Next 가 하이드레이션 데이터를 인라인 <script> 로 심는다
 *   style  — 화면 코드가 style={{ }} 인라인 속성을 쓴다
 * 대신 XSS 싱크가 없다. dangerouslySetInnerHTML·innerHTML·eval 을 한 군데도 안 쓰고
 * React 가 값을 이스케이프한다.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
];

const COMMON = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // 위젯은 은행 앱 안에 iframe 으로 얹히는 게 존재 이유다. 여기만 프레임을 허용한다.
        // 채널 연계 화면이 같은 출처에서 임베드하므로 'self' 로 충분하다.
        source: "/widget",
        headers: [
          ...COMMON,
          { key: "Content-Security-Policy", value: [...CSP, "frame-ancestors 'self'"].join("; ") },
        ],
      },
      {
        // /widget 은 위에서 따로 잡는다. 여기서 다시 걸면 프레임 허용이 DENY 로 덮인다.
        source: "/((?!widget$).*)",
        headers: [
          ...COMMON,
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: [...CSP, "frame-ancestors 'none'"].join("; ") },
        ],
      },
    ];
  },
};

export default nextConfig;
