/**
 * 사례 공유 — 서버 저장 없이 링크로 넘긴다.
 *
 * 건강·소득 정보를 서버에 저장하지 않겠다고 했으므로, 공유도 저장 없이 해야 한다.
 * 상태를 URL 프래그먼트에 담으면 서버 로그에도 남지 않는다(#뒤는 전송되지 않는다).
 */

import type { AnalyzeInput } from "./engine/analyze";

/** URL-safe base64 */
function toB64Url(s: string): string {
  const b64 = typeof window === "undefined" ? Buffer.from(s, "utf8").toString("base64") : btoa(unescape(encodeURIComponent(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  return typeof window === "undefined"
    ? Buffer.from(pad, "base64").toString("utf8")
    : decodeURIComponent(escape(atob(pad)));
}

export function encodeCase(input: AnalyzeInput): string {
  return toB64Url(JSON.stringify(input));
}

export function decodeCase(encoded: string): AnalyzeInput | null {
  try {
    const parsed = JSON.parse(fromB64Url(encoded));
    // 최소 검증 — 형태가 안 맞으면 버린다
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.finances || !parsed.setting) return null;
    return parsed as AnalyzeInput;
  } catch {
    return null;
  }
}

export function buildShareUrl(input: AnalyzeInput): string {
  const base = typeof window === "undefined" ? "" : `${window.location.origin}${window.location.pathname}`;
  return `${base}#case=${encodeCase(input)}`;
}

export function readCaseFromHash(): AnalyzeInput | null {
  if (typeof window === "undefined") return null;
  const m = window.location.hash.match(/case=([A-Za-z0-9\-_]+)/);
  return m ? decodeCase(m[1]) : null;
}

/**
 * 형제 분담 — 금전과 시간을 공통 단위로 환산한다.
 * 돌봄 갈등은 대개 "누가 더 했나"를 서로 다른 단위로 세기 때문에 생긴다.
 */
export interface Contributor {
  id: string;
  name: string;
  /** 월 금전 부담 (원) */
  money: number;
  /** 월 돌봄 시간 (시간) */
  hours: number;
}

export interface FairnessResult {
  /** 시간을 금전으로 환산한 시간당 단가 */
  hourlyRate: number;
  rows: {
    contributor: Contributor;
    hoursValued: number;
    total: number;
    sharePct: number;
    /** 균등 분담 대비 차이 */
    vsEqual: number;
  }[];
  grandTotal: number;
  /** 가장 많이 부담하는 사람과 가장 적게 부담하는 사람의 차이 */
  spread: number;
}

/**
 * 돌봄 시간의 금전 환산 단가.
 * 방문요양 시장가를 기준으로 삼는다 — 그 일을 외부에 맡기면 실제로 드는 돈이다.
 */
export const CARE_HOUR_RATE = 18_000;

export function evaluateFairness(
  contributors: Contributor[],
  hourlyRate = CARE_HOUR_RATE,
): FairnessResult {
  const rows = contributors.map((c) => {
    const hoursValued = c.hours * hourlyRate;
    return { contributor: c, hoursValued, total: c.money + hoursValued, sharePct: 0, vsEqual: 0 };
  });

  const grandTotal = rows.reduce((s, r) => s + r.total, 0);
  const equal = rows.length > 0 ? grandTotal / rows.length : 0;

  for (const r of rows) {
    r.sharePct = grandTotal === 0 ? 0 : (r.total / grandTotal) * 100;
    r.vsEqual = r.total - equal;
  }

  const totals = rows.map((r) => r.total);
  const spread = totals.length > 0 ? Math.max(...totals) - Math.min(...totals) : 0;

  return { hourlyRate, rows, grandTotal, spread };
}
