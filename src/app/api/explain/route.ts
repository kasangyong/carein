import {
  getProvider,
  listProviders,
  maskPII,
  neutralizeInjection,
  detectUngrounded,
  type ProviderKind,
  type ExplainRequest,
} from "@/lib/ai/provider";
import { getProgram } from "@/lib/kb/programs";

export async function GET() {
  return Response.json({ providers: listProviders() });
}

/**
 * 설명 생성. LLM이 개입하는 유일한 경로.
 *
 * 가드레일 순서
 *   1. 인젝션 무력화 (업로드 문서에서 온 텍스트일 수 있음)
 *   2. PII 마스킹 — 모델 전송 전
 *   3. 생성
 *   4. 근거 없는 금액 탐지 → 발견 시 경고와 함께 반환
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const kind = (body.provider as ProviderKind) ?? undefined;
    const task = (body.task as ExplainRequest["task"]) ?? "program-summary";
    const facts = body.facts ?? {};
    const programIds: string[] = body.programIds ?? [];

    const citations = programIds
      .map((id) => getProgram(id))
      .filter((p): p is NonNullable<typeof p> => !!p)
      .map((p) => ({
        id: p.id,
        title: p.name,
        text: [
          p.summary,
          p.benefit,
          p.monthlyAmount !== null ? `월 ${p.monthlyAmount.toLocaleString("ko-KR")}원` : "",
          `근거: ${p.legalBasis}`,
          `신청처: ${p.applyAt}`,
          p.caveat ? `유의: ${p.caveat}` : "",
        ]
          .filter(Boolean)
          .join("\n"),
      }));

    if (citations.length === 0) {
      return Response.json({
        text: "인용할 수 있는 제도 근거가 없어 설명을 생성하지 않았습니다.",
        blocked: true,
        reason: "no-citations",
      });
    }

    // 1 & 2. 가드레일
    const rawFacts = JSON.stringify(facts);
    const { text: cleaned, found: injections } = neutralizeInjection(rawFacts);
    const safeFacts = JSON.parse(maskPII(cleaned));

    const provider = getProvider(kind);
    const info = provider.info();

    // 3. 생성
    const text = await provider.explain({ facts: safeFacts, citations, task });

    // 4. 근거 검증
    const ungrounded = detectUngrounded(text, citations, safeFacts);

    return Response.json({
      text,
      provider: info,
      guardrails: {
        injectionsBlocked: injections,
        piiMasked: rawFacts !== cleaned || JSON.stringify(safeFacts) !== cleaned,
        ungroundedFindings: ungrounded,
        citationCount: citations.length,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "설명 생성 중 오류가 발생했습니다.";
    return Response.json({ error: message }, { status: 500 });
  }
}
