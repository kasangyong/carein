/**
 * 제도 가치 환산 (RULE)
 *
 * 제도가 재무에 주는 영향은 세 가지 모양이다.
 *   1. 현금을 준다        — 가족요양비, 기초연금
 *   2. 한도 안에서 대준다  — 복지용구
 *   3. 낼 돈을 깎아준다    — 장기요양 본인부담금 감경
 *
 * 지금까지는 1번만 셌다. 그래서 21개 제도 중 2개만 금액에 반영됐고
 * "확인하고 신청하면" 막대가 움직일 재료가 없었다.
 *
 * 환산하지 않는 것도 명시한다. 본인부담상한제·재난적 의료비·의료비 세액공제는
 * 연간 정산이나 개별 심사로 금액이 정해진다. 미리 숫자를 붙이면 그건 추정이
 * 아니라 창작이다. 이 제도들은 금액 없이 "확인 필요"로만 보여준다.
 */

import type { Program } from "../kb/programs";
import { HOME_CARE_COPAY_RATE, FACILITY_COPAY_RATE, type CopayTier } from "./rates";
import type { CareSetting } from "./cost";

export interface ValuationContext {
  setting: CareSetting;
  copayTier: CopayTier;
  /** 급여 대상 총액 (공단 부담 + 본인부담) */
  coveredGross: number;
}

export interface ValuedSupport {
  programId: string;
  name: string;
  monthly: number;
  /** 이 금액이 어떻게 나왔는지 — 화면에 그대로 뿌린다 */
  basis: string;
  confidence: "high" | "medium" | "low";
}

/** 감경을 신청했을 때 옮겨갈 구간. 소득·재산 심사 결과에 따라 40% 또는 60%다 */
const REDUCTION_TARGET: CopayTier = "reduced40";

function copayRate(setting: CareSetting, tier: CopayTier): number {
  return setting === "facility" ? FACILITY_COPAY_RATE[tier] : HOME_CARE_COPAY_RATE[tier];
}

/**
 * 제도 하나의 월 환산액. 환산 근거가 없으면 null 을 돌려준다.
 * null 은 "가치가 없다"가 아니라 "숫자로 말할 근거가 없다"는 뜻이다.
 */
export function valuate(program: Program, ctx: ValuationContext): ValuedSupport | null {
  const v = program.valuation;
  if (!v) return null;

  switch (v.kind) {
    case "annualCap": {
      // 한도액은 공단부담금과 본인부담금의 합이다. 실제 이득은 공단이 내주는 몫.
      const rate = copayRate(ctx.setting, ctx.copayTier);
      const monthly = Math.round((v.annualLimit * (1 - rate)) / 12);
      return {
        programId: program.id,
        name: program.name,
        monthly,
        basis: `연 한도 ${v.annualLimit.toLocaleString("ko-KR")}원 × 공단부담 ${Math.round((1 - rate) * 100)}% ÷ 12개월. 한도를 다 쓴다고 가정한 값입니다.`,
        confidence: "medium",
      };
    }

    case "copayReduction": {
      // 감경은 요율이 고시로 확정돼 있어 계산이 정확하다.
      // 이미 감경 구간이면 더 깎일 것이 없다.
      const now = copayRate(ctx.setting, ctx.copayTier);
      const after = copayRate(ctx.setting, REDUCTION_TARGET);
      if (after >= now) return null;
      const monthly = Math.round(ctx.coveredGross * (now - after));
      if (monthly <= 0) return null;
      return {
        programId: program.id,
        name: program.name,
        monthly,
        basis: `급여 대상액 ${ctx.coveredGross.toLocaleString("ko-KR")}원에 본인부담률이 ${Math.round(now * 100)}% → ${Math.round(after * 100)}% 로 낮아집니다. 60% 감경 대상이면 더 줄어듭니다.`,
        confidence: "high",
      };
    }
  }
}
