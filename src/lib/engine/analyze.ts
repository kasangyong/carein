/**
 * 오케스트레이터 — 프로파일 하나를 받아 전체 분석을 돌린다.
 *
 * 순서가 곧 화면 순서다.
 *   1. 제도 발굴  (RULE 판정)
 *   2. 비용 산출  (RULE)
 *   3. 다년 계산  (RULE)
 *   4. 의사결정   (RULE)
 *   5. 설명 생성  (LLM — 위 결과를 말로 옮기기만 함)
 */

import { matchPrograms, type CareProfile, type MatchSummary } from "./match";
import { calculateMonthlyCost, type CostResult, type CareSetting, type GradeOrNone, NO_GRADE } from "./cost";
import { simulate, sensitivity, type SimulateResult } from "./simulate";
import { evaluateQuitDecision, evaluateFamilyCaregiver, type DecisionResult } from "./decision";
import { valuate, type ValuedSupport } from "./valuation";
import type { CopayTier } from "./rates";

export interface AnalyzeInput {
  profile: CareProfile;
  finances: {
    recipientAssets: number;
    recipientMonthlyIncome: number;
    caregiverAssets: number;
    caregiverMonthlyIncome: number;
    caregiverMonthlyExpense: number;
    caregiverTenureYears: number;
    caregiverAge: number;
    siblingCount: number;
  };
  setting: CareSetting;
  horizonYears?: number;
  careDurationMonths?: number;
  /** 비용 산출 세부 — 이용률, 한도 초과, 간병 유형, 급여화 대상 여부 */
  costDetail?: {
    utilization?: number;
    overCapUsage?: number;
    caregiverType?: "private" | "shared";
    caregiverPilotEligible?: boolean;
  };
}

export interface AnalyzeResult {
  programs: MatchSummary;
  cost: CostResult;
  simulation: SimulateResult;
  /** 제도를 못 찾았을 경우 — 비교 기준선 */
  simulationWithoutPrograms: SimulateResult;
  /** 현금이 아닌 제도의 월 환산액과 그 근거 */
  valuedSupport: ValuedSupport[];
  sensitivity: ReturnType<typeof sensitivity>;
  decision: DecisionResult;
  familyCaregiver: ReturnType<typeof evaluateFamilyCaregiver>;
  headline: {
    /** 몰랐던 제도 수 */
    overlookedCount: number;
    /** 연간 지원 가능액 */
    annualSupport: number;
    /** 몇 년 버티나 */
    survival: string;
    /** 월 실부담 */
    monthlyBurden: number;
    /** 제도 적용 전 월 부담 */
    monthlyBurdenBefore: number;
    /** 퇴사 결정이 직관과 뒤집혔는가 */
    decisionReversal: boolean;
    survivalWithoutPrograms: string;
    /** 늘어난 총 개월 */
    monthsGainedByPrograms: number;
    /** 그중 간병비 급여화 대상 확인에서 나온 몫 */
    monthsGainedByPilot: number;
    /** 그중 제도 신청에서 나온 몫 */
    monthsGainedBySupport: number;
    /** 늘어난 기간의 주된 원인 */
    gainDriver: "pilot" | "support" | "both" | "none";
  };
}

export function analyze(input: AnalyzeInput): AnalyzeResult {
  const horizonYears = input.horizonYears ?? 10;
  const careDurationMonths = input.careDurationMonths ?? 48;
  const grade: GradeOrNone = input.profile.ltcGrade ?? NO_GRADE;
  const copayTier = (input.profile.copayTier ?? "general") as CopayTier;

  // 1. 제도 발굴
  const programs = matchPrograms(input.profile);
  const programSupportMonthly = programs.countableMonthlyTotal;

  // 2. 비용 산출
  const detail = input.costDetail ?? {};
  const cost = calculateMonthlyCost({
    grade,
    setting: input.setting,
    copayTier,
    ...detail,
    // 확인만 하면 적용되는 경우를 함께 보여준다
    caregiverPilotEligible: input.setting === "hospital" ? true : detail.caregiverPilotEligible,
  });
  /** 제도를 아무것도 못 찾았을 때의 비용 — 급여화도 미적용 */
  const costWithoutPrograms = calculateMonthlyCost({
    grade,
    setting: input.setting,
    copayTier,
    ...detail,
    caregiverPilotEligible: false,
  });

  // 3. 다년 계산
  const costShareRatio =
    input.finances.siblingCount > 0 ? 1 / (input.finances.siblingCount + 1) : 1;

  const simInput = {
    grade,
    setting: input.setting,
    copayTier,
    recipientAssets: input.finances.recipientAssets,
    recipientMonthlyIncome: input.finances.recipientMonthlyIncome,
    caregiverAssets: input.finances.caregiverAssets,
    caregiverMonthlyIncome: input.finances.caregiverMonthlyIncome,
    caregiverMonthlyExpense: input.finances.caregiverMonthlyExpense,
    programSupportMonthly,
    costShareRatio,
    horizonYears,
    gradeProgression: true,
    pilotEligibleFromYear: detail.caregiverPilotEligible ? 2026 : undefined,
    utilization: detail.utilization,
    overCapUsage: detail.overCapUsage,
    caregiverType: detail.caregiverType,
  };
  /**
   * 게이지의 두 막대.
   *   asIs   = 지금 그대로. 아무것도 신청 안 하고 급여화도 확인 안 한 상태.
   *   ifDone = 해당·확인필요 제도를 전부 신청하고 급여화 대상으로 확인된 경우.
   * ifDone 은 확정이 아니라 "확인하면 이렇게 됩니다"라서 화면에 그렇게 표시한다.
   */
  const asIs = simulate({
    ...simInput,
    programSupportMonthly: 0,
    pilotEligibleFromYear: undefined,
  });
  /**
   * 현금이 아닌 제도의 환산액.
   * 해당 + 확인필요를 함께 본다. 막대의 뜻이 "확인하고 신청하면"이기 때문이다.
   */
  const valuedSupport = [...programs.eligible, ...programs.unknown]
    .map((m) => valuate(m.program, { setting: input.setting, copayTier, coveredGross: cost.coveredGross }))
    .filter((v): v is ValuedSupport => v !== null);
  const valuedMonthlyTotal = valuedSupport.reduce((s, v) => s + v.monthly, 0);

  /**
   * 제도가 재무에 닿는 방식이 둘이라 분리한다.
   *   비용 감면 — 낼 돈이 줄어든다. 월 실부담에서 뺀다.
   *   소득 증가 — 부모 통장에 돈이 들어온다. 부담액은 그대로고 순현금흐름만 좋아진다.
   * 둘을 섞으면 "월 실부담 0원" 같은 표시가 나온다. 부담이 없어진 게 아니라
   * 다른 데서 메운 것이므로 그렇게 쓰면 안 된다.
   */
  const cashPrograms = [...programs.eligible, ...programs.unknown].filter(
    (m) => m.monthlyAmount !== null,
  );
  /** cap = 실제 지출을 되메워 주는 제도(치매치료관리비 등). fixed = 통장에 들어오는 현금 */
  const costReduction =
    valuedMonthlyTotal +
    cashPrograms
      .filter((m) => m.program.amountKind === "cap")
      .reduce((sum, m) => sum + (m.monthlyAmount ?? 0), 0);
  const incomeSupport = cashPrograms
    .filter((m) => m.program.amountKind !== "cap")
    .reduce((sum, m) => sum + (m.monthlyAmount ?? 0), 0);
  const bestCaseSupport = costReduction + incomeSupport;
  const pilotFromYear =
    input.setting === "hospital" ? 2026 : simInput.pilotEligibleFromYear;
  /**
   * 늘어난 기간의 원인을 갈라 본다.
   *
   * 요양병원 사례에서 막대가 2년 → 9년 9개월로 벌어지는데, 그 대부분은
   * 제도 신청이 아니라 간병비 급여화 대상 확인에서 나온다. 헤드라인이
   * "놓친 제도 5개 · 연 36만원" 옆에 93개월을 붙이면 원인을 잘못 가리킨다.
   * 연 36만원으로 93개월이 늘어날 수는 없다.
   */
  const pilotOnly = simulate({
    ...simInput,
    programSupportMonthly: 0,
    pilotEligibleFromYear: pilotFromYear,
  });
  const simulation = simulate({
    ...simInput,
    programSupportMonthly: bestCaseSupport,
    pilotEligibleFromYear: pilotFromYear,
  });
  const simulationWithoutPrograms = asIs;

  const depletion = (r: SimulateResult) =>
    r.recipientDepletionMonth ?? horizonYears * 12;
  const monthsGainedByPilot = depletion(pilotOnly) - depletion(asIs);
  const monthsGainedBySupport = depletion(simulation) - depletion(pilotOnly);
  const sens = sensitivity(simInput);

  // 4. 의사결정
  //
  // 퇴사한다고 돌봄비가 0이 되지 않는다. 돌봄 장소마다 대체 가능한 정도가 다르다.
  //  - 요양병원: 1등급 환자를 혼자 24시간 볼 수 없다. 야간·주말은 사람을 써야 해서
  //    간병비의 상당 부분이 남는다.
  //  - 시설: 퇴소해 집으로 모시면 재가 돌봄으로 전환된다.
  //  - 재가: 방문요양 이용을 줄이고 가족이 메운다.
  const costIfQuitting = (() => {
    const familyCost = calculateMonthlyCost({ grade, setting: "family", copayTier }).monthlyTotal;
    if (input.setting === "hospital") {
      // 가족 상주 간병으로 낮 시간을 대체해도 야간·주말 간병은 남는다
      const RESIDUAL_HOSPITAL_CARE = 0.35;
      return Math.round(costWithoutPrograms.monthlyTotal * RESIDUAL_HOSPITAL_CARE);
    }
    return familyCost;
  })();

  const decision = evaluateQuitDecision({
    monthlyIncome: input.finances.caregiverMonthlyIncome,
    tenureYears: input.finances.caregiverTenureYears,
    age: input.finances.caregiverAge,
    // 퇴사 판단은 "지금 내가 실제로 내고 있는 돈" 기준이어야 한다.
    // 아직 확인 안 된 혜택을 미리 반영하면 현실과 다른 결론이 나온다.
    careCostIfWorking: costWithoutPrograms.monthlyTotal,
    careCostIfQuitting: costIfQuitting,
    careDurationMonths,
    horizonYears,
    programSupportIfQuitting: programs.countableMonthlyTotal,
  });

  const familyCaregiver = evaluateFamilyCaregiver({
    expectedMonthlyPay: 900_000,
    careDurationMonths,
  });

  return {
    programs,
    cost,
    simulation,
    simulationWithoutPrograms,
    valuedSupport,
    sensitivity: sens,
    decision,
    familyCaregiver,
    headline: {
      overlookedCount: programs.overlooked.length,
      annualSupport: bestCaseSupport * 12,
      survival: simulation.survivalLabel,
      monthlyBurden: Math.max(0, cost.monthlyTotal - costReduction),
      monthlyBurdenBefore: costWithoutPrograms.monthlyTotal,
      decisionReversal: decision.isReversal,
      survivalWithoutPrograms: simulationWithoutPrograms.survivalLabel,
      monthsGainedByPrograms: monthsGainedByPilot + monthsGainedBySupport,
      monthsGainedByPilot,
      monthsGainedBySupport,
      gainDriver:
        monthsGainedByPilot + monthsGainedBySupport <= 0
          ? "none"
          : monthsGainedByPilot >= (monthsGainedByPilot + monthsGainedBySupport) * 0.7
            ? "pilot"
            : monthsGainedBySupport >= (monthsGainedByPilot + monthsGainedBySupport) * 0.7
              ? "support"
              : "both",
    },
  };
}
