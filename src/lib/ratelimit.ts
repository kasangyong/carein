/**
 * 모델 호출 경로 레이트 리밋
 *
 * 설명 생성과 문서 판독은 외부 모델을 부른다. 공개 URL에 그대로 열려 있으면
 * 누구든 반복 호출로 무료 한도를 태울 수 있고, 그러면 심사 기간에 데모가 죽는다.
 * 대회 요건이 "URL이 기간 내 접근 가능할 것"이므로 이건 가용성 문제다.
 *
 * 저장소를 두지 않는다는 원칙이 있어 IP를 기록하지 않는다.
 * 메모리에 IP 해시와 호출 시각만 들고, 창이 지나면 지운다.
 * 서버리스라 인스턴스별로 각각 센다 — 완벽한 차단이 아니라 폭주를 늦추는 장치다.
 */

import { createHash } from "crypto";

interface Bucket {
  hits: number[];
}

const buckets = new Map<string, Bucket>();

/**
 * 원본 IP를 남기지 않는다. 같은 요청자인지만 알면 된다.
 * 경로를 키에 넣는다. 안 넣으면 한도가 엔드포인트끼리 새서,
 * 설명 생성을 몇 번 부르면 문서 판독이 먼저 막힌다.
 */
function keyOf(req: Request, scope: string): string {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  return scope + ":" + createHash("sha256").update(ip).digest("hex").slice(0, 16);
}

export interface RateLimitResult {
  ok: boolean;
  /** 다음 시도까지 남은 초 */
  retryAfter: number;
}

export function rateLimit(
  req: Request,
  scope: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const key = keyOf(req, scope);

  // 지난 창의 흔적은 그때그때 버린다. 따로 청소 타이머를 두지 않는다.
  for (const [k, b] of buckets) {
    b.hits = b.hits.filter((t) => now - t < windowMs);
    if (b.hits.length === 0) buckets.delete(k);
  }

  const bucket = buckets.get(key) ?? { hits: [] };
  if (bucket.hits.length >= limit) {
    const oldest = bucket.hits[0];
    return { ok: false, retryAfter: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }

  bucket.hits.push(now);
  buckets.set(key, bucket);
  return { ok: true, retryAfter: 0 };
}

export function tooManyRequests(retryAfter: number): Response {
  return Response.json(
    { error: `요청이 너무 잦습니다. ${retryAfter}초 후에 다시 시도해 주세요.` },
    { status: 429, headers: { "Retry-After": String(retryAfter) } },
  );
}
