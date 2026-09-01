/**
 * 돌봄 비용 산출 엔진 — 전부 결정론적 계산 (RULE)
 *
 * 설계 원칙
 *  1. LLM은 이 파일의 어떤 숫자도 만들지 않는다.
 *  2. 모든 계산은 CalcStep 배열로 기록되어 화면에 그대로 전개된다.
 *  3. 같은 입력이면 항상 같은 출력. 재현성 100%.
 */

import {
  type Grade,
  type CopayTier,
  HOME_CARE_MONTHLY_CAP,
  FACILITY_DAILY_RATE,
  HOME_CARE_COPAY_RATE,
  FACILITY_COPAY_RATE,
  FACILITY_NON_COVERED_MONTHLY,
  HOSPITAL_CAREGIVER_MONTHLY,
  CAREGIVER_COVERAGE_PILOT,
  COGNITIVE_GRADE_EXCLUDES_HOME_VISIT,
  GRADE_LABEL,
  RATE_SOURCES,
} from "./rates";

/** 돌봄 형태 */
export type CareSetting = "home" | "daycare" | "facility" | "hospital" | "family";

/** 등급 미보유 — 장기요양 급여 대상이 아니라 전액 자부담이 된다 */
export const NO_GRADE = "none" as const;
export type GradeOrNone = Grade | typeof NO_GRADE;

export const CARE_SETTING_LABEL: Record<CareSetting, string> = {
  home: "재가 (방문요양)",
  daycare: "주야간보호",
  facility: "요양시설 (요양원)",
  hospital: "요양병원",
  family: "가족 직접돌봄",
};

/** 계산 한 단계 — UI가 이걸 그대로 렌더링한다 */
export interface CalcStep {
  label: string;
  formula: string;
  amount: number;
  /** 이 단계의 근거 출처 */
  source?: string;
  /** 음수면 차감 항목 */
  kind: "base" | "covered" | "copay" | "extra" | "deduction" | "total";
}

export interface CostInput {
  grade: GradeOrNone;
  setting: CareSetting;
  copayTier: CopayTier;
  /** 월 이용 비율 (재가). 1.0 = 한도 100% 소진 */
  utilization?: number;
  /** 한도 초과 이용분 (원). 전액 본인부담 */
  overCapUsage?: number;
  /** 요양병원 간병 유형 */
  caregiverType?: "private" | "shared";
  /** 2026 급여화 시범사업 대상 여부 */
  caregiverPilotEligible?: boolean;
  /** 시설 비급여 — 미지정 시 typical 사용 */
  facilityRoomUpgrade?: number;
}

export interface CostResult {
  monthlyTotal: number;
  steps: CalcStep[];
  warnings: string[];
  /** 이 등급으로 이 돌봄 형태를 아예 이용할 수 없는 경우 */
  unavailable?: { reason: string };
  /** 급여 대상 총액 (공단 부담 + 본인부담) */
  coveredGross: number;
  /** 전액 본인부담 항목 합계 */
  outOfPocketExtra: number;
}

const DAYS_PER_MONTH = 30;

function won(n: number): string {
  return Math.round(n).toLocaleString("ko-KR") + "원";
}

function pct(n: number): string {
  return (n * 100).toFixed(0) + "%";
}

/**
 * 월 돌봄 비용을 산출한다.
 * 반환된 steps를 순서대로 화면에 뿌리면 그게 곧 계산 근거가 된다.
 */
export function calculateMonthlyCost(input: CostInput): CostResult {
  const {
    grade,
    setting,
    copayTier,
    utilization = 1.0,
    overCapUsage = 0,
    caregiverType = "shared",
    caregiverPilotEligible = false,
    facilityRoomUpgrade,
  } = input;

  const steps: CalcStep[] = [];
  const warnings: string[] = [];
  let coveredGross = 0;
  let copay = 0;
  let extra = 0;

  // 등급이 없으면 장기요양 급여가 적용되지 않는다. 서비스는 쓸 수 있지만 전액 자부담이다.
  if (grade === NO_GRADE) {
    return noGradeCost(setting, steps, warnings);
  }

  // 인지지원등급 제약 — 경고로 끝내면 안 된다. 이용 자체가 안 되므로 금액을 내지 않는다.
  if (grade === "cognitive" && setting === "home" && COGNITIVE_GRADE_EXCLUDES_HOME_VISIT) {
    const reason =
      "인지지원등급은 방문요양을 이용할 수 없습니다. 주야간보호(치매전담실 포함)·단기보호·복지용구만 가능합니다.";
    return {
      monthlyTotal: 0,
      steps: [{ label: "이용 불가", formula: reason, amount: 0, kind: "total" }],
      warnings: [reason],
      coveredGross: 0,
      outOfPocketExtra: 0,
      unavailable: { reason },
    };
  }
  if (grade === "cognitive" && setting === "facility") {
    const reason = "인지지원등급은 시설급여(요양원) 대상이 아닙니다.";
    return {
      monthlyTotal: 0,
      steps: [{ label: "이용 불가", formula: reason, amount: 0, kind: "total" }],
      warnings: [reason],
      coveredGross: 0,
      outOfPocketExtra: 0,
      unavailable: { reason },
    };
  }

  switch (setting) {
    case "home":
    case "daycare": {
      const cap = HOME_CARE_MONTHLY_CAP[grade];
      const used = Math.round(cap * utilization);
      const rate = HOME_CARE_COPAY_RATE[copayTier];

      steps.push({
        label: `${GRADE_LABEL[grade]} 재가급여 월 한도액`,
        formula: `2026년 고시 기준`,
        amount: cap,
        source: RATE_SOURCES.homeCareCap,
        kind: "base",
      });

      if (utilization < 1) {
        steps.push({
          label: "실제 이용액",
          formula: `${won(cap)} × ${pct(utilization)}`,
          amount: used,
          kind: "base",
        });
      }

      coveredGross = used;
      copay = Math.round(used * rate);

      steps.push({
        label: `본인부담 (${copayTierLabel(copayTier)})`,
        formula: `${won(used)} × ${pct(rate)}`,
        amount: copay,
        source: RATE_SOURCES.copayRate,
        kind: "copay",
      });

      if (overCapUsage > 0) {
        extra += overCapUsage;
        steps.push({
          label: "한도 초과 이용분",
          formula: "한도를 넘는 이용분은 전액 본인부담",
          amount: overCapUsage,
          source: RATE_SOURCES.homeCareCap,
          kind: "extra",
        });
        warnings.push(
          `월 한도 ${won(cap)}를 ${won(overCapUsage)} 초과했습니다. 초과분은 급여가 적용되지 않아 전액 본인부담입니다.`,
        );
      }
      break;
    }

    case "facility": {
      const daily = FACILITY_DAILY_RATE[grade];
      const gross = daily * DAYS_PER_MONTH;
      const rate = FACILITY_COPAY_RATE[copayTier];

      steps.push({
        label: `${GRADE_LABEL[grade]} 시설급여 1일 수가`,
        formula: "2026년 고시 기준",
        amount: daily,
        source: RATE_SOURCES.facilityRate,
        kind: "base",
      });
      steps.push({
        label: "월 급여비용",
        formula: `${won(daily)} × ${DAYS_PER_MONTH}일`,
        amount: gross,
        kind: "base",
      });

      coveredGross = gross;
      copay = Math.round(gross * rate);

      steps.push({
        label: `본인부담 (${copayTierLabel(copayTier)})`,
        formula: `${won(gross)} × ${pct(rate)}`,
        amount: copay,
        source: RATE_SOURCES.copayRate,
        kind: "copay",
      });

      // 비급여 — 급여에 포함되지 않아 전액 본인부담
      const meals = FACILITY_NON_COVERED_MONTHLY.meals.typical;
      const room = facilityRoomUpgrade ?? FACILITY_NON_COVERED_MONTHLY.premiumRoom.typical;
      const personal = FACILITY_NON_COVERED_MONTHLY.personalCare.typical;
      const supplies = FACILITY_NON_COVERED_MONTHLY.supplies.typical;

      for (const [amount, label] of [
        [meals, FACILITY_NON_COVERED_MONTHLY.meals.label],
        [room, FACILITY_NON_COVERED_MONTHLY.premiumRoom.label],
        [personal, FACILITY_NON_COVERED_MONTHLY.personalCare.label],
        [supplies, FACILITY_NON_COVERED_MONTHLY.supplies.label],
      ] as const) {
        if (amount > 0) {
          extra += amount;
          steps.push({
            label: `비급여 — ${label}`,
            formula: "급여 미적용, 전액 본인부담",
            amount,
            kind: "extra",
          });
        }
      }
      warnings.push(
        "비급여 항목(식재료비·상급침실료 등)은 기관마다 다릅니다. 여기 값은 일반적인 수준이며 실제 계약서로 확인이 필요합니다.",
      );
      break;
    }

    case "hospital": {
      const c = HOSPITAL_CAREGIVER_MONTHLY[caregiverType];
      const rate = caregiverPilotEligible
        ? CAREGIVER_COVERAGE_PILOT.copayRateIfEligible
        : CAREGIVER_COVERAGE_PILOT.copayRateOtherwise;

      steps.push({
        label: `요양병원 간병비 — ${c.label}`,
        formula: "2026년 시장 평균",
        amount: c.typical,
        kind: "base",
      });

      const paid = Math.round(c.typical * rate);
      extra += paid;

      if (caregiverPilotEligible) {
        steps.push({
          label: "간병비 급여화 적용 (2026 시범사업)",
          formula: `${won(c.typical)} × ${pct(rate)}`,
          amount: paid,
          source: RATE_SOURCES.caregiverPilot,
          kind: "copay",
        });
        steps.push({
          label: "급여화로 줄어든 금액",
          formula: `${won(c.typical)} − ${won(paid)}`,
          amount: -(c.typical - paid),
          source: RATE_SOURCES.caregiverPilot,
          kind: "deduction",
        });
      } else {
        steps.push({
          label: "간병비 본인부담 (급여화 미적용)",
          formula: "전액 본인부담",
          amount: paid,
          kind: "extra",
        });
        warnings.push(
          "2026년 하반기부터 일부 요양병원에서 간병비 급여화가 시작됩니다. 해당 병원이 대상이면 본인부담이 30%로 낮아집니다. 대상 여부를 확인해 보세요.",
        );
      }
      break;
    }

    case "family": {
      // 가족이 직접 돌봐도 현금 지출이 0이 되지는 않는다.
      // 실무상 방문요양을 일부 병행하고, 의료비·소모품은 그대로 든다.
      const cap = HOME_CARE_MONTHLY_CAP[grade];
      const partialUse = Math.round(cap * 0.3);
      const rate = HOME_CARE_COPAY_RATE[copayTier];

      steps.push({
        label: "방문요양 부분 이용 (한도의 30%)",
        formula: "가족이 직접 돌봐도 통원·목욕 등은 서비스를 병행합니다",
        amount: partialUse,
        source: RATE_SOURCES.homeCareCap,
        kind: "base",
      });

      coveredGross = partialUse;
      copay = Math.round(partialUse * rate);
      steps.push({
        label: `본인부담 (${copayTierLabel(copayTier)})`,
        formula: `${won(partialUse)} × ${pct(rate)}`,
        amount: copay,
        source: RATE_SOURCES.copayRate,
        kind: "copay",
      });

      const supplies = FACILITY_NON_COVERED_MONTHLY.supplies.typical;
      extra += supplies;
      steps.push({
        label: "기저귀 등 소모품",
        formula: "돌봄 장소와 무관하게 발생",
        amount: supplies,
        kind: "extra",
      });

      warnings.push(
        "가족이 직접 돌보면 현금 지출은 줄지만 소득 감소·경력단절 비용이 발생합니다. 아래 의사결정에서 다년 손익을 확인하세요.",
      );
      break;
    }
  }

  const monthlyTotal = copay + extra;

  steps.push({
    label: "월 실부담 합계",
    formula: extra > 0 ? `본인부담 ${won(copay)} + 비급여·기타 ${won(extra)}` : `본인부담 ${won(copay)}`,
    amount: monthlyTotal,
    kind: "total",
  });

  return { monthlyTotal, steps, warnings, coveredGross, outOfPocketExtra: extra };
}

function copayTierLabel(t: CopayTier): string {
  return { general: "일반 대상", reduced40: "경감 40%", reduced60: "경감 60%", basic: "기초생활수급자" }[t];
}

/** 급여화 시범사업 대상 여부 판정 — 전 조건 충족 시에만 true */
export interface PilotEligibilityInput {
  bedCount?: number;
  directlyEmploysCaregivers?: boolean;
  designatedMedicalCentric?: boolean;
  severityHigh?: boolean;
}

export function checkCaregiverPilotEligibility(i: PilotEligibilityInput) {
  const checks = [
    { label: "100병상 이상", pass: (i.bedCount ?? 0) >= 100, known: i.bedCount !== undefined },
    { label: "간병인 직접고용", pass: !!i.directlyEmploysCaregivers, known: i.directlyEmploysCaregivers !== undefined },
    { label: "의료중심 요양병원 지정", pass: !!i.designatedMedicalCentric, known: i.designatedMedicalCentric !== undefined },
    { label: "의료중증도 고도 이상", pass: !!i.severityHigh, known: i.severityHigh !== undefined },
  ];
  const unknown = checks.filter((c) => !c.known);
  const failed = checks.filter((c) => c.known && !c.pass);

  return {
    eligible: unknown.length === 0 && failed.length === 0,
    /** 하나라도 모르면 단정하지 않는다 */
    undetermined: unknown.length > 0 && failed.length === 0,
    checks,
    source: RATE_SOURCES.caregiverPilot,
  };
}

export { won as formatWon };


/** 등급 미보유 시 비용 — 급여 없이 전액 자부담 */
function noGradeCost(setting: CareSetting, steps: CalcStep[], warnings: string[]): CostResult {
  warnings.push(
    "장기요양 등급이 없으면 급여가 적용되지 않아 서비스 비용을 전액 부담합니다. 등급 신청이 재무적으로 가장 큰 한 수입니다.",
  );

  let total = 0;
  if (setting === "hospital") {
    const c = HOSPITAL_CAREGIVER_MONTHLY.shared;
    total = c.typical;
    steps.push({
      label: `요양병원 간병비 — ${c.label}`,
      formula: "2026년 시장 평균, 전액 본인부담",
      amount: c.typical,
      kind: "extra",
    });
  } else if (setting === "facility") {
    const reason =
      "장기요양 등급이 없으면 노인요양시설(요양원) 입소가 원칙적으로 어렵습니다. 유료 노인복지주택이나 요양병원이 대안입니다.";
    return {
      monthlyTotal: 0,
      steps: [{ label: "이용 불가", formula: reason, amount: 0, kind: "total" }],
      warnings: [reason],
      coveredGross: 0,
      outOfPocketExtra: 0,
      unavailable: { reason },
    };
  } else {
    const supplies = FACILITY_NON_COVERED_MONTHLY.supplies.typical;
    const selfPaidVisit = 700_000; // 자비 방문요양 시장가 근사
    total = supplies + selfPaidVisit;
    steps.push({
      label: "자비 방문요양",
      formula: "급여 미적용, 전액 본인부담",
      amount: selfPaidVisit,
      kind: "extra",
    });
    steps.push({
      label: "기저귀 등 소모품",
      formula: "돌봄 장소와 무관하게 발생",
      amount: supplies,
      kind: "extra",
    });
  }

  steps.push({
    label: "월 실부담 합계",
    formula: "장기요양 급여 미적용",
    amount: total,
    kind: "total",
  });

  return { monthlyTotal: total, steps, warnings, coveredGross: 0, outOfPocketExtra: total };
}
