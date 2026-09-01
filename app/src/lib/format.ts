/** 금액 표기 — 사람이 읽는 단위로 끊는다. 1억이 넘으면 "만원"으로 세지 않는다. */
export function money(n: number): string {
  const v = Math.round(Math.abs(n));
  const sign = n < 0 ? "−" : "";
  if (v === 0) return "0원";
  if (v < 10_000) return `${sign}${v.toLocaleString("ko-KR")}원`;
  if (v < 100_000_000) return `${sign}${Math.round(v / 10_000).toLocaleString("ko-KR")}만원`;
  const eok = Math.floor(v / 100_000_000);
  const man = Math.round((v % 100_000_000) / 10_000);
  return man === 0 ? `${sign}${eok}억원` : `${sign}${eok}억 ${man.toLocaleString("ko-KR")}만원`;
}

/** 원 단위 그대로 (계산 전개용) */
export function won(n: number): string {
  return `${Math.round(n).toLocaleString("ko-KR")}원`;
}
