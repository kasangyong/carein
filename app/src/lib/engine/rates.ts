/**
 * 2026년 노인장기요양보험 급여 기준값
 *
 * 모든 값은 공개 자료에서 교차 검증됨 (2026-09-01 확인, 2개 이상 출처 일치).
 * 이 파일의 숫자는 전부 결정론적 계산에만 쓰인다. LLM은 이 값을 생성하지 않는다.
 *
 * 출처
 *  - 재가급여 월 한도액 / 시설급여 1일 수가: 보건복지부 2026년 장기요양 급여비용 고시
 *  - 본인부담률: 노인장기요양보험법 시행령
 *  - 가족요양비: 2026년 특별현금급여 고시
 */

export const RATES_YEAR = 2026 as const;

export type Grade = "1" | "2" | "3" | "4" | "5" | "cognitive";

export const GRADE_LABEL: Record<Grade, string> = {
  "1": "1등급",
  "2": "2등급",
  "3": "3등급",
  "4": "4등급",
  "5": "5등급",
  cognitive: "인지지원등급",
};

/** 재가급여 월 한도액 (원). 이 한도를 넘는 이용분은 전액 본인부담. */
export const HOME_CARE_MONTHLY_CAP: Record<Grade, number> = {
  "1": 2_512_900,
  "2": 2_331_200,
  "3": 1_528_200,
  "4": 1_409_700,
  "5": 1_208_900,
  cognitive: 676_320,
};

/** 2025년 한도액 — 인상폭 표시용 */
export const HOME_CARE_MONTHLY_CAP_2025: Record<Grade, number> = {
  "1": 2_306_400,
  "2": 2_083_400,
  "3": 1_485_700,
  "4": 1_370_600,
  "5": 1_177_000,
  cognitive: 657_400,
};

/** 시설급여 1일 수가 (원) */
export const FACILITY_DAILY_RATE: Record<Grade, number> = {
  "1": 93_070,
  "2": 86_340,
  "3": 81_540,
  "4": 81_540,
  "5": 81_540,
  // 인지지원등급은 시설급여 대상이 아님 (주야간보호·단기보호·복지용구만 가능)
  cognitive: 0,
};

/** 본인부담 경감 구분 */
export type CopayTier = "general" | "reduced40" | "reduced60" | "basic";

export const COPAY_TIER_LABEL: Record<CopayTier, string> = {
  general: "일반",
  reduced40: "경감 40%",
  reduced60: "경감 60%",
  basic: "기초생활수급자",
};

/** 재가급여 본인부담률 */
export const HOME_CARE_COPAY_RATE: Record<CopayTier, number> = {
  general: 0.15,
  reduced40: 0.09,
  reduced60: 0.06,
  basic: 0,
};

/** 시설급여 본인부담률 */
export const FACILITY_COPAY_RATE: Record<CopayTier, number> = {
  general: 0.2,
  reduced40: 0.12,
  reduced60: 0.08,
  basic: 0,
};

/**
 * 인지지원등급은 방문요양을 이용할 수 없다.
 * 주야간보호(치매전담실 포함), 단기보호, 복지용구만 가능.
 */
export const COGNITIVE_GRADE_EXCLUDES_HOME_VISIT = true;

/** 시설급여 비급여 항목 월 추정치 (원). 기관·지역별 편차가 커서 범위로 보관. */
export const FACILITY_NON_COVERED_MONTHLY = {
  meals: { min: 300_000, typical: 450_000, max: 700_000, label: "식재료비" },
  premiumRoom: { min: 0, typical: 0, max: 900_000, label: "상급침실료" },
  personalCare: { min: 20_000, typical: 40_000, max: 80_000, label: "이·미용비" },
  supplies: { min: 50_000, typical: 100_000, max: 200_000, label: "기저귀 등 소모품" },
} as const;

/**
 * 요양병원 간병비 (2026년 시장가).
 * 2026.7.28 발표 급여화 시범사업 대상이면 본인부담률이 100% → 30%로 낮아진다.
 */
export const HOSPITAL_CAREGIVER_MONTHLY = {
  /** 1:1 개인 간병 — 하루 12~14만원 */
  private: { min: 3_600_000, typical: 3_900_000, max: 4_200_000, label: "1:1 개인간병" },
  /** 공동 간병 (간병인 1인이 다수 환자 담당) */
  shared: { min: 700_000, typical: 1_000_000, max: 1_400_000, label: "공동간병" },
} as const;

/**
 * 2026년 하반기 시행 요양병원 간병비 급여화 시범사업.
 * 대상 판정 조건 — 전부 충족해야 함.
 */
export const CAREGIVER_COVERAGE_PILOT = {
  effectiveFrom: "2026-07",
  copayRateIfEligible: 0.3,
  copayRateOtherwise: 1.0,
  conditions: [
    "100병상 이상 요양병원",
    "간병인 직접고용 기관",
    "의료중심 요양병원으로 지정 (2026년 약 200곳)",
    "환자 의료중증도가 최고도·고도 또는 중증·희귀난치 중 일부",
  ],
  /** 단계 확대 일정 — 다년 시뮬레이션에서 연도별 적용 */
  rollout: [
    { year: 2026, facilities: 200 },
    { year: 2028, facilities: 350 },
    { year: 2030, facilities: 500 },
  ],
} as const;

/** 가족요양비 (특별현금급여) 월 지급액 */
export const FAMILY_CARE_ALLOWANCE_MONTHLY = 240_450;

/** 가족돌봄휴가 연간 한도 (2026년 11일 → 12일 확대) */
export const FAMILY_CARE_LEAVE_DAYS = 12;

/** 표시용 — 값 하나하나가 어디서 왔는지 UI에서 노출 */
export const RATE_SOURCES = {
  homeCareCap: "보건복지부 2026년 장기요양 급여비용 고시",
  facilityRate: "보건복지부 2026년 장기요양 급여비용 고시",
  copayRate: "노인장기요양보험법 시행령",
  familyAllowance: "2026년 특별현금급여 고시",
  caregiverPilot: "보건복지부 요양병원 간병비 급여화 추진방안 (2026.7.28)",
} as const;
