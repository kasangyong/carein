import { PROGRAMS } from "@/lib/kb/programs";

/**
 * 지식베이스 공개 — 오픈 API.
 * 판정 근거를 외부에서 검증할 수 있게 원문 그대로 내보낸다.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const tag = url.searchParams.get("tag");
  const beneficiary = url.searchParams.get("beneficiary");
  const verifiedOnly = url.searchParams.get("verified") === "true";

  let items = PROGRAMS;
  if (tag) items = items.filter((p) => p.tags.includes(tag));
  if (beneficiary) items = items.filter((p) => p.beneficiary === beneficiary || p.beneficiary === "both");
  if (verifiedOnly) items = items.filter((p) => p.verified === "confirmed");

  return Response.json({
    count: items.length,
    total: PROGRAMS.length,
    programs: items,
    note: "verified가 needs-check인 항목은 원문 대조 전이라 금액 합계에 넣지 않습니다.",
  });
}
