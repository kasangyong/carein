/**
 * 다년 현금흐름 시뮬레이션 (RULE)
 *
 * 답해야 하는 질문은 하나다: "이대로 가면 몇 년 버티나?"
 * 부모 자산과 자녀 자산을 분리해서 각각의 소진 시점을 낸다.
 */

import { calculateMonthlyCost, type CareSetting, type GradeOrNone, NO_GRADE } from "./cost";
import type { CopayTier } from "./rates";
import { CAREGIVER_COVERAGE_PILOT } from "./rates";

export interface SimulateInput {
  grade: GradeOrNone;
  setting: CareSetting;
  copayTier: CopayTier;

  /** 부모 보유 금융자산 (원) */
  recipientAssets: number;
  /** 부모 월 소득 — 국민연금·기초연금 등 (원) */
  recipientMonthlyIncome: number;

  /** 자녀 보유 금융자산 (원) */
  caregiverAssets: number;
  /** 자녀 월 소득 (원) */
  caregiverMonthlyIncome: number;
  /** 자녀 월 생활비 (본인 가계) */
  caregiverMonthlyExpense: number;

  /** 제도 지원으로 매달 줄어드는 금액 */
  programSupportMonthly: number;

  /** 형제 분담 — 자녀 본인이 부담하는 비율 0~1 */
  costShareRatio: number;

  horizonYears: number;
  careCostInflation?: number;
  /** 등급 악화 시나리오 적용 */
  gradeProgression?: boolean;
  /** 요양병원 간병비 급여화 대상 편입 예상 연도 */
  pilotEligibleFromYear?: number;
  /** 비용 산출 세부 — 매달 재계산할 때 그대로 전달된다 */
  utilization?: number;
  overCapUsage?: number;
  caregiverType?: "private" | "shared";
}

export interface MonthPoint {
  monthIndex: number;
  year: number;
  careCost: number;
  /** 부모 소득으로 충당하고 남은 부족분 */
  shortfall: number;
  recipientAssets: number;
  caregiverAssets: number;
  grade: GradeOrNone;
  pilotApplied: boolean;
}

export interface SimulateResult {
  points: MonthPoint[];
  /** 부모 자산 소진 시점 (개월). null 이면 기간 내 소진 안 됨 */
  recipientDepletionMonth: number | null;
  caregiverDepletionMonth: number | null;
  /** 사람이 읽는 요약 */
  survivalLabel: string;
  totalCareCost: number;
  totalProgramSupport: number;
  peakMonthlyCost: number;
  notes: string[];
}

const GRADE_WORSENING: Record<GradeOrNone, GradeOrNone> = {
  none: NO_GRADE,
  cognitive: "5",
  "5": "4",
  "4": "3",
  "3": "2",
  "2": "1",
  "1": "1",
};

export function simulate(input: SimulateInput): SimulateResult {
  const {
    grade,
    setting,
    copayTier,
    recipientAssets,
    recipientMonthlyIncome,
    caregiverAssets,
    caregiverMonthlyIncome,
    caregiverMonthlyExpense,
    programSupportMonthly,
    costShareRatio,
    horizonYears,
    careCostInflation = 0.04,
    gradeProgression = false,
    pilotEligibleFromYear,
    utilization,
    overCapUsage,
    caregiverType,
  } = input;

  const months = horizonYears * 12;
  const points: MonthPoint[] = [];
  const notes: string[] = [];

  let rAssets = recipientAssets;
  let cAssets = caregiverAssets;
  let currentGrade = grade;
  let recipientDepletionMonth: number | null = null;
  let caregiverDepletionMonth: number | null = null;
  let totalCareCost = 0;
  let totalProgramSupport = 0;
  let peakMonthlyCost = 0;

  for (let m = 0; m < months; m++) {
    const year = 2026 + Math.floor(m / 12);
    const infl = Math.pow(1 + careCostInflation, m / 12);

    // 등급 악화 — 18개월마다 한 단계
    if (gradeProgression && m > 0 && m % 18 === 0) {
      const next = GRADE_WORSENING[currentGrade];
      if (next !== currentGrade) {
        currentGrade = next;
        notes.push(`${Math.floor(m / 12) + 1}년차: 등급이 ${currentGrade}등급으로 악화한다고 가정했습니다.`);
      }
    }

    const pilotApplied =
      setting === "hospital" &&
      pilotEligibleFromYear !== undefined &&
      year >= pilotEligibleFromYear;

    const cost = calculateMonthlyCost({
      grade: currentGrade,
      setting,
      copayTier,
      utilization,
      overCapUsage,
      caregiverType,
      caregiverPilotEligible: pilotApplied,
    });

    const careCost = Math.round(cost.monthlyTotal * infl);
    const support = Math.min(programSupportMonthly, careCost);
    const netCare = careCost - support;

    totalCareCost += careCost;
    totalProgramSupport += support;
    peakMonthlyCost = Math.max(peakMonthlyCost, careCost);

    // 부모 소득이 먼저 돌봄비를 부담하고, 부족분을 부모 자산에서 뺀다
    const afterIncome = netCare - recipientMonthlyIncome;
    let shortfall = 0;

    if (afterIncome <= 0) {
      rAssets += -afterIncome; // 남은 소득은 자산에 쌓임
    } else if (rAssets >= afterIncome) {
      rAssets -= afterIncome;
    } else {
      shortfall = afterIncome - rAssets;
      rAssets = 0;
      if (recipientDepletionMonth === null) recipientDepletionMonth = m;
    }

    // 부모 자산이 마르면 자녀가 분담 비율만큼 떠안는다
    const caregiverBurden = shortfall * costShareRatio;
    const caregiverNet = caregiverMonthlyIncome - caregiverMonthlyExpense - caregiverBurden;
    cAssets += caregiverNet;
    if (cAssets < 0 && caregiverDepletionMonth === null) {
      caregiverDepletionMonth = m;
    }

    points.push({
      monthIndex: m,
      year,
      careCost,
      shortfall,
      recipientAssets: Math.max(0, Math.round(rAssets)),
      caregiverAssets: Math.round(cAssets),
      grade: currentGrade,
      pilotApplied,
    });
  }

  if (recipientDepletionMonth === null) {
    notes.push(`${horizonYears}년 안에는 부모님 자산이 소진되지 않습니다.`);
  }
  if (setting === "hospital" && pilotEligibleFromYear === undefined) {
    notes.push(
      `요양병원 간병비 급여화 시범사업(${CAREGIVER_COVERAGE_PILOT.effectiveFrom} 시작)에 해당 병원이 포함되는지 확인해 보세요. 대상이면 간병비 본인부담이 30%로 낮아집니다.`,
    );
  }

  return {
    points,
    recipientDepletionMonth,
    caregiverDepletionMonth,
    survivalLabel: formatSurvival(recipientDepletionMonth, horizonYears),
    totalCareCost,
    totalProgramSupport,
    peakMonthlyCost,
    notes,
  };
}

function formatSurvival(depletionMonth: number | null, horizonYears: number): string {
  if (depletionMonth === null) return `${horizonYears}년 이상`;
  const y = Math.floor(depletionMonth / 12);
  const m = depletionMonth % 12;
  if (y === 0) return `${m}개월`;
  if (m === 0) return `${y}년`;
  return `${y}년 ${m}개월`;
}

/** 여러 시나리오 병렬 비교 */
export interface ScenarioSpec {
  id: string;
  label: string;
  overrides: Partial<SimulateInput>;
}

export function compareScenarios(base: SimulateInput, scenarios: ScenarioSpec[]) {
  return scenarios.map((s) => ({
    id: s.id,
    label: s.label,
    result: simulate({ ...base, ...s.overrides }),
  }));
}

/** 민감도 분석 — 어떤 변수가 결과를 가장 크게 흔드는가 */
export function sensitivity(base: SimulateInput) {
  const baseline = simulate(base);
  const baseMonths = baseline.recipientDepletionMonth ?? base.horizonYears * 12;

  const levers: { key: keyof SimulateInput; label: string; delta: number }[] = [
    { key: "programSupportMonthly", label: "제도 지원금", delta: 300_000 },
    { key: "costShareRatio", label: "형제 분담 비율", delta: -0.25 },
    { key: "recipientMonthlyIncome", label: "부모 월 소득", delta: 200_000 },
    { key: "careCostInflation", label: "돌봄비 상승률", delta: 0.02 },
  ];

  return levers
    .map((l) => {
      const cur = base[l.key];
      if (typeof cur !== "number") return null;
      const modified = simulate({ ...base, [l.key]: cur + l.delta } as SimulateInput);
      const months = modified.recipientDepletionMonth ?? base.horizonYears * 12;
      return {
        label: l.label,
        change: l.delta,
        monthsGained: months - baseMonths,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => Math.abs(b.monthsGained) - Math.abs(a.monthsGained));
}
