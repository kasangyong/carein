import { ATTACK_CASES, runAllAttacks, runAttack, summarize } from "@/lib/ai/redteam";
import { neutralizeInjection, maskPII, enforceHedging } from "@/lib/ai/provider";

export async function GET() {
  const results = runAllAttacks();
  return Response.json({ cases: ATTACK_CASES, results, summary: summarize(results) });
}

/** 심사위원이 직접 입력한 문장을 가드레일에 통과시켜 본다 */
export async function POST(req: Request) {
  try {
    const { payload, caseId } = await req.json();

    if (caseId) {
      const c = ATTACK_CASES.find((x) => x.id === caseId);
      if (!c) return Response.json({ error: "없는 케이스입니다." }, { status: 400 });
      return Response.json({ result: runAttack(c) });
    }

    if (typeof payload !== "string" || payload.length === 0) {
      return Response.json({ error: "검사할 문장을 입력해 주세요." }, { status: 400 });
    }
    if (payload.length > 4000) {
      return Response.json({ error: "4000자 이하로 입력해 주세요." }, { status: 413 });
    }

    const inj = neutralizeInjection(payload);
    const masked = maskPII(inj.text);
    const hedged = enforceHedging(masked);

    return Response.json({
      custom: {
        before: payload,
        afterInjection: inj.text,
        afterPII: masked,
        afterHedging: hedged,
        injectionsBlocked: inj.found,
        piiMasked: masked !== inj.text,
        hedgingApplied: hedged !== masked,
        anyBlocked: inj.found.length > 0 || masked !== inj.text || hedged !== masked,
      },
    });
  } catch {
    return Response.json({ error: "검사 중 오류가 발생했습니다." }, { status: 500 });
  }
}
