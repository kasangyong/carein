import {
  getProvider,
  listProviders,
  maskPII,
  neutralizeInjection,
  detectUngrounded,
  isProviderKind,
  type ProviderKind,
  type ExplainRequest,
} from "@/lib/ai/provider";
import { getProgram } from "@/lib/kb/programs";
import { rateLimit, tooManyRequests } from "@/lib/ratelimit";

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
const TASKS = ["program-summary", "decision-rationale", "next-steps"] as const;
/** facts 는 그대로 프롬프트에 실린다. 크기를 안 재면 비용과 지연이 요청자 손에 있게 된다 */
const MAX_FACTS_BYTES = 16 * 1024;
const MAX_PROGRAM_IDS = 40;

export async function POST(req: Request) {
  const rl = rateLimit(req, "explain", 10, 60_000);
  if (!rl.ok) return tooManyRequests(rl.retryAfter);

  let body: Record<string, unknown>;
  try {
    const parsed = await req.json();
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return Response.json({ error: "요청 본문은 객체여야 합니다." }, { status: 400 });
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return Response.json({ error: "요청 본문이 JSON 형식이 아닙니다." }, { status: 400 });
  }

  try {
    if (body.provider !== undefined && !isProviderKind(body.provider)) {
      return Response.json(
        { error: "provider 는 onprem · gemini · claude 중 하나여야 합니다." },
        { status: 400 },
      );
    }
    const kind = body.provider as ProviderKind | undefined;

    if (body.task !== undefined && !TASKS.includes(body.task as (typeof TASKS)[number])) {
      return Response.json(
        { error: `task 는 ${TASKS.join(" · ")} 중 하나여야 합니다.` },
        { status: 400 },
      );
    }
    const task = (body.task as ExplainRequest["task"]) ?? "program-summary";

    const facts = body.facts ?? {};
    if (JSON.stringify(facts).length > MAX_FACTS_BYTES) {
      return Response.json({ error: "facts 가 너무 큽니다." }, { status: 413 });
    }

    if (body.programIds !== undefined && !Array.isArray(body.programIds)) {
      return Response.json({ error: "programIds 는 배열이어야 합니다." }, { status: 400 });
    }
    const programIds: string[] = ((body.programIds as unknown[]) ?? [])
      .filter((id): id is string => typeof id === "string")
      .slice(0, MAX_PROGRAM_IDS);

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
