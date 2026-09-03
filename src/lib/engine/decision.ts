/**
 * 의사결정 엔진 — 퇴사 vs 유지 다년 손익 (RULE)
 *
 * 이 서비스의 핵심이다. 직관은 "간병비가 월급보다 크면 그만둬라"인데,
 * 다년으로 보면 자주 뒤집힌다. 그 계산을 여기서 한다.
 *
 * 정직성 원칙
 *  - 추정이 들어가는 값은 전부 Assumption으로 노출한다. 숨기지 않는다.
 *  - 가정은 주입 가능하다. assumptions 를 넘기면 그 값으로 다시 계산한다.
 *  - 근거가 약한 가정은 confidence: "low"로 표시한다.
 */

export type Confidence = "high" | "medium" | "low";

export interface Assumption {
  key: string;
  label: string;
  value: number;
  unit: "won" | "rate" | "years" | "months";
  /** 이 값이 어디서 왔는가 */
  basis: string;
  confidence: Confidence;
  editable: boolean;
}

export const DEFAULT_ASSUMPTIONS: Assumption[] = [
  {
    key: "wageScarRate",
    label: "경력단절 후 복귀 임금 하락률",
    value: 0.15,
    unit: "rate",
    basis: "단절 기간이 길수록 복귀 임금이 낮아진다는 일반적 경향에 기반한 보수적 가정. 개인차가 큰 값입니다.",
    confidence: "low",
    editable: true,
  },
  {
    key: "reemploymentDelayMonths",
    label: "돌봄 종료 후 재취업까지 걸리는 기간",
    value: 6,
    unit: "months",
    basis: "가정값. 연령·직종에 따라 편차가 큽니다.",
    confidence: "low",
    editable: true,
  },
  {
    key: "wageGrowthRate",
    label: "재직 시 연간 임금 상승률",
    value: 0.03,
    unit: "rate",
    basis: "가정값",
    confidence: "medium",
    editable: true,
  },
  {
    key: "careCostInflation",
    label: "돌봄비용 연간 상승률",
    value: 0.04,
    unit: "rate",
    basis: "장기요양 수가 인상 추이 기반 가정",
    confidence: "medium",
    editable: true,
  },
  {
    key: "pensionReplacementPerYear",
    label: "국민연금 가입 1년당 소득대체율 기여",
    value: 0.01,
    unit: "rate",
    basis: "소득대체율 40% / 40년 가입 기준 근사치. 실제 산식(A값·B값)은 더 복잡합니다.",
    confidence: "low",
    editable: true,
  },
  {
    key: "severancePerYear",
    label: "퇴직금 연간 적립 (월급 대비)",
    value: 1,
    unit: "rate",
    basis: "근로자퇴직급여보장법 — 계속근로 1년당 30일분 평균임금",
    confidence: "high",
    editable: false,
  },
  {
    key: "localHealthInsuranceMonthly",
    label: "지역가입 전환 시 월 건강보험료",
    value: 150_000,
    unit: "won",
    basis: "가정값. 재산·소득에 따라 크게 달라집니다.",
    confidence: "low",
    editable: true,
  },
];

export interface DecisionInput {
  /** 본인 월 소득 (세후, 원) */
  monthlyIncome: number;
  /** 근속연수 */
  tenureYears: number;
  /** 나이 — 은퇴까지 남은 기간 산정 */
  age: number;
  /** 퇴사하지 않을 경우 매달 나가는 돌봄비 (원) */
  careCostIfWorking: number;
  /** 퇴사하고 직접 돌볼 경우 매달 나가는 돌봄비 (원) */
  careCostIfQuitting: number;
  /** 예상 돌봄 기간 (개월) */
  careDurationMonths: number;
  /** 시뮬레이션 기간 (년) */
  horizonYears: number;
  /** 퇴사 시 받게 되는 제도 지원 월액 (가족요양비 등) */
  programSupportIfQuitting?: number;
  assumptions?: Assumption[];
}

export interface YearlyFlow {
  year: number;
  keepJob: { income: number; careCost: number; net: number };
  quit: { income: number; careCost: number; support: number; net: number };
  delta: number;
}

export interface DecisionResult {
  recommendation: "keep" | "quit" | "close";
  /** 유지 - 퇴사. 양수면 유지가 유리 */
  totalDelta: number;
  yearly: YearlyFlow[];
  /** 손익을 가른 항목별 기여도 */
  breakdown: { label: string; amount: number; note: string }[];
  /** 직관적 판단 (월 단위 단순 비교) — 반전 여부를 보여주기 위함 */
  naiveMonthlyDelta: number;
  naiveRecommendation: "keep" | "quit";
  /** 직관과 다년 결과가 뒤집혔는가 */
  isReversal: boolean;
  assumptions: Assumption[];
  irreversibleWarnings: string[];
}

function a(assumptions: Assumption[], key: string): number {
  const found = assumptions.find((x) => x.key === key);
  if (!found) throw new Error(`가정값 누락: ${key}`);
  return found.value;
}

export function evaluateQuitDecision(input: DecisionInput): DecisionResult {
  const assumptions = input.assumptions ?? DEFAULT_ASSUMPTIONS;
  const {
    monthlyIncome,
    tenureYears,
    age,
    careCostIfWorking,
    careCostIfQuitting,
    careDurationMonths,
    horizonYears,
    programSupportIfQuitting = 0,
  } = input;

  const scar = a(assumptions, "wageScarRate");
  const delayMonths = a(assumptions, "reemploymentDelayMonths");
  const wageGrowth = a(assumptions, "wageGrowthRate");
  const careInflation = a(assumptions, "careCostInflation");
  const pensionPerYear = a(assumptions, "pensionReplacementPerYear");
  const localHealth = a(assumptions, "localHealthInsuranceMonthly");

  const careYears = careDurationMonths / 12;
  const yearly: YearlyFlow[] = [];

  let keepTotal = 0;
  let quitTotal = 0;

  /**
   * 손익 분해용 누적기.
   *
   * 예전에는 breakdown 을 루프와 무관하게 고정값으로 다시 계산했다. 그래서
   * 화면에 총액 7,845만원과 표 합계 6,099만원이 함께 떠서 1,746만원이 어긋났다.
   * 상승률과 재취업 지연이 총액에는 들어가고 표에는 안 들어갔기 때문이다.
   * 같은 항목을 두 번 계산하면 반드시 갈라지므로, 루프에서 직접 모은다.
   */
  let incomeGapNoWork = 0;
  let incomeGapAfterReturn = 0;
  let careSaved = 0;
  let supportTotal = 0;
  let healthTotal = 0;

  for (let y = 0; y < horizonYears; y++) {
    const infl = Math.pow(1 + careInflation, y);
    const growth = Math.pow(1 + wageGrowth, y);

    // 돌봄은 영원히 계속되지 않는다. careDurationMonths 안에서만 비용이 발생한다.
    // 이 연도에 돌봄이 몇 개월 걸쳐 있는지 계산한다.
    const yearStart = y * 12;
    const careMonthsThisYear = Math.max(
      0,
      Math.min(careDurationMonths, yearStart + 12) - yearStart,
    );

    // --- 유지 시나리오 ---
    const keepIncome = monthlyIncome * growth * 12;
    const keepCare = careCostIfWorking * infl * careMonthsThisYear;
    const keepNet = keepIncome - keepCare;

    // --- 퇴사 시나리오 ---
    // 돌봄 기간 동안 소득 0, 이후 재취업 지연 → 복귀 시 임금 하락
    const monthsElapsed = yearStart;
    let quitIncome = 0;

    const backToWorkAtMonth = careDurationMonths + delayMonths;
    if (monthsElapsed + 12 <= backToWorkAtMonth) {
      quitIncome = 0;
    } else if (monthsElapsed >= backToWorkAtMonth) {
      quitIncome = monthlyIncome * (1 - scar) * growth * 12;
    } else {
      // 부분 연도 — 복귀가 연중에 일어남
      const workingMonths = monthsElapsed + 12 - backToWorkAtMonth;
      quitIncome = monthlyIncome * (1 - scar) * growth * workingMonths;
    }

    const quitCare = careCostIfQuitting * infl * careMonthsThisYear;
    const support = programSupportIfQuitting * careMonthsThisYear;
    // 퇴사 후 소득이 없는 기간에는 지역가입 건강보험료 발생
    const healthCost = quitIncome === 0 ? localHealth * 12 : 0;
    const quitNet = quitIncome + support - quitCare - healthCost;

    keepTotal += keepNet;
    quitTotal += quitNet;

    if (quitIncome === 0) incomeGapNoWork += keepIncome - quitIncome;
    else incomeGapAfterReturn += keepIncome - quitIncome;
    careSaved += keepCare - quitCare;
    supportTotal += support;
    healthTotal += healthCost;

    yearly.push({
      year: y + 1,
      keepJob: { income: keepIncome, careCost: keepCare, net: keepNet },
      quit: { income: quitIncome, careCost: quitCare, support, net: quitNet },
      delta: keepNet - quitNet,
    });
  }

  // --- 시야 밖 손실: 연금·퇴직금 ---
  // 국민연금 가입기간 손실 → 은퇴 후 수령액 감소를 현재가치 근사로 반영
  const pensionGapYears = careYears + delayMonths / 12;
  const expectedPensionYears = 20; // 65세부터 85세까지 수령 가정
  const pensionLoss =
    monthlyIncome * pensionPerYear * pensionGapYears * 12 * expectedPensionYears;

  // 퇴직금 — 퇴사 시점에 정산되고 이후 적립 중단
  const severanceLoss = monthlyIncome * pensionGapYears;

  keepTotal += pensionLoss + severanceLoss;

  const totalDelta = keepTotal - quitTotal;

  // --- 직관적 판단 (월 단위 단순 비교) ---
  const naiveMonthlyDelta =
    monthlyIncome - (careCostIfWorking - careCostIfQuitting) - programSupportIfQuitting;
  const naiveRecommendation: "keep" | "quit" = naiveMonthlyDelta > 0 ? "keep" : "quit";

  const recommendation: DecisionResult["recommendation"] =
    Math.abs(totalDelta) < monthlyIncome * 3 ? "close" : totalDelta > 0 ? "keep" : "quit";

  const isReversal =
    recommendation !== "close" && recommendation !== naiveRecommendation;

  /**
   * 합이 totalDelta 와 정확히 같아야 한다.
   *   totalDelta = Σ(keepNet − quitNet) + pensionLoss + severanceLoss
   *              = 소득차 − 돌봄비절약 − 제도지원 + 건보료 + 연금 + 퇴직금
   */
  const breakdown = [
    {
      label: "무소득 기간 소득 손실",
      amount: incomeGapNoWork,
      note: `퇴사 후 재취업까지 ${Math.round((careDurationMonths + delayMonths) / 12 * 10) / 10}년간 소득이 없습니다 (임금 상승률 반영)`,
    },
    {
      label: "복귀 후 임금 하락 누적",
      amount: incomeGapAfterReturn,
      note: `복귀 임금이 ${(scar * 100).toFixed(0)}% 낮아진다고 가정했을 때의 잔여 기간 누적`,
    },
    {
      label: "돌봄비 절약분",
      amount: -careSaved,
      note: "직접 돌보면 줄어드는 지출 (돌봄비 상승률 반영)",
    },
    {
      label: "퇴사 시 받는 제도 지원",
      amount: -supportTotal,
      note:
        supportTotal > 0
          ? "해당 판정된 제도만 반영했습니다"
          : "이 사례에서 해당하는 현금 지원 제도가 없습니다",
    },
    {
      label: "지역가입 건강보험료",
      amount: healthTotal,
      note: "직장가입 자격 상실 시 발생",
    },
    {
      label: "국민연금 수령액 감소",
      amount: pensionLoss,
      note: `가입기간 ${pensionGapYears.toFixed(1)}년 결손의 평생 영향 (근사치)`,
    },
    {
      label: "퇴직금 적립 중단",
      amount: severanceLoss,
      note: `근속 ${tenureYears}년에서 중단`,
    },
  ];

  const irreversibleWarnings: string[] = [];
  if (recommendation === "quit" || naiveRecommendation === "quit") {
    irreversibleWarnings.push(
      "퇴사는 되돌리기 어려운 결정입니다. 근로시간 단축이나 가족돌봄휴직을 먼저 검토해 보세요.",
    );
  }
  if (age >= 50) {
    irreversibleWarnings.push(
      "50세 이후 경력 단절은 재취업이 특히 어렵습니다. 위 복귀 가정이 낙관적일 수 있습니다.",
    );
  }
  if (recommendation === "close") {
    irreversibleWarnings.push(
      "두 선택의 차이가 크지 않습니다. 금액만으로 결정하지 마시고 돌봄 강도와 본인 건강도 함께 고려하세요.",
    );
  }

  return {
    recommendation,
    totalDelta,
    yearly,
    breakdown,
    naiveMonthlyDelta,
    naiveRecommendation,
    isReversal,
    assumptions,
    irreversibleWarnings,
  };
}

/**
 * 가족인 요양보호사 손익
 * 자격 취득 비용·시간 대비 받게 되는 급여를 비교한다.
 */
export interface FamilyCaregiverInput {
  /** 자격 취득 교육비 (원) */
  trainingCost?: number;
  /** 취득까지 걸리는 개월 */
  trainingMonths?: number;
  /** 월 예상 급여 (재가센터 소속 근로) */
  expectedMonthlyPay: number;
  /** 돌봄 예상 기간 (개월) */
  careDurationMonths: number;
}

export function evaluateFamilyCaregiver(i: FamilyCaregiverInput) {
  const trainingCost = i.trainingCost ?? 600_000;
  const trainingMonths = i.trainingMonths ?? 2;
  const earningMonths = Math.max(0, i.careDurationMonths - trainingMonths);
  const totalPay = i.expectedMonthlyPay * earningMonths;
  const net = totalPay - trainingCost;

  return {
    worthwhile: net > 0,
    trainingCost,
    trainingMonths,
    earningMonths,
    totalPay,
    net,
    breakEvenMonths:
      i.expectedMonthlyPay > 0
        ? Math.ceil(trainingCost / i.expectedMonthlyPay) + trainingMonths
        : Infinity,
    note: "가족인 요양보호사는 재가센터에 소속되어 근로계약을 맺어야 하며, 공단 등록 시점부터 급여가 산정됩니다.",
  };
}
