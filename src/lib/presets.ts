/**
 * 데모 프리셋
 *
 * 설계 규칙
 *  - 숫자를 데모용으로 꾸미지 않는다. 실제로 재무가 무너지는 조건을 고른다.
 *  - 재가 3~5등급은 본인부담이 작아서 위기가 안 온다. 위기는 요양병원 개인간병과
 *    시설 입소에서 온다. 그래서 그 두 가지를 앞에 둔다.
 *  - 3번은 일부러 "제도가 거의 없는" 케이스다.
 *    전부 다 받을 수 있다고 나오는 데모는 신뢰를 잃는다.
 */

import type { AnalyzeInput } from "./engine/analyze";

export interface Preset {
  id: string;
  title: string;
  subtitle: string;
  demonstrates: string;
  input: AnalyzeInput;
}

export const PRESETS: Preset[] = [
  {
    id: "hospital",
    title: "요양병원 · 개인간병",
    subtitle: "80세 어머니 · 1등급 · 딸 47세 · 월 240만원",
    demonstrates: "간병비가 월급을 넘는 상황. 퇴사 판단이 뒤집히는 지점",
    input: {
      profile: {
        recipientAge: 80,
        ltcGrade: "1",
        hasDementiaDiagnosis: true,
        remoteArea: false,
        incomePercentile: 105,
        copayTier: "general",
        careSetting: "hospital",
        region: "경기도 성남시",
        livesAlone: false,
        hasFamilySupport: true,
        caregiverEmployed: true,
        caregiverMonthlyIncome: 2_400_000,
        caregiverAge: 47,
        caregiverTenureYears: 15,
        siblingCount: 1,
      },
      finances: {
        recipientAssets: 82_000_000,
        recipientMonthlyIncome: 700_000,
        caregiverAssets: 60_000_000,
        caregiverMonthlyIncome: 2_400_000,
        caregiverMonthlyExpense: 2_050_000,
        caregiverTenureYears: 15,
        caregiverAge: 47,
        siblingCount: 1,
      },
      setting: "hospital",
      horizonYears: 10,
      careDurationMonths: 42,
      costDetail: {
        caregiverType: "private",
        // 아직 급여화 대상 여부를 확인하지 못한 상태 — 대부분의 가족이 여기 있다.
        // 확인해서 대상이 되면 본인부담이 100%에서 30%로 떨어진다.
        caregiverPilotEligible: false,
      },
    },
  },
  {
    id: "facility",
    title: "요양원 입소",
    subtitle: "83세 아버지 · 2등급 · 아들 55세 · 형제 없음",
    demonstrates: "비급여가 본인부담보다 큰 구조. 자산 소진 시점",
    input: {
      profile: {
        recipientAge: 83,
        ltcGrade: "2",
        hasDementiaDiagnosis: false,
        remoteArea: false,
        incomePercentile: 90,
        copayTier: "general",
        careSetting: "facility",
        region: "부산광역시",
        livesAlone: false,
        hasFamilySupport: true,
        caregiverEmployed: true,
        caregiverMonthlyIncome: 2_800_000,
        caregiverAge: 55,
        caregiverTenureYears: 22,
        siblingCount: 0,
      },
      finances: {
        recipientAssets: 31_000_000,
        recipientMonthlyIncome: 480_000,
        caregiverAssets: 34_000_000,
        caregiverMonthlyIncome: 2_800_000,
        caregiverMonthlyExpense: 2_450_000,
        caregiverTenureYears: 22,
        caregiverAge: 55,
        siblingCount: 0,
      },
      setting: "facility",
      horizonYears: 10,
      careDurationMonths: 60,
    },
  },
  {
    id: "few-programs",
    title: "받을 수 있는 제도가 적은 경우",
    subtitle: "71세 어머니 · 등급 없음 · 소득 상위 · 딸 42세",
    demonstrates: "해당 없는 제도는 해당 없다고 말합니다",
    input: {
      profile: {
        recipientAge: 71,
        ltcGrade: null,
        hasDementiaDiagnosis: false,
        remoteArea: false,
        incomePercentile: 180,
        copayTier: "general",
        careSetting: "home",
        region: "서울특별시 강남구",
        hasFamilySupport: true,
        caregiverEmployed: true,
        caregiverMonthlyIncome: 4_500_000,
        caregiverAge: 42,
        caregiverTenureYears: 9,
        siblingCount: 2,
      },
      finances: {
        recipientAssets: 150_000_000,
        recipientMonthlyIncome: 1_100_000,
        caregiverAssets: 80_000_000,
        caregiverMonthlyIncome: 4_500_000,
        caregiverMonthlyExpense: 3_500_000,
        caregiverTenureYears: 9,
        caregiverAge: 42,
        siblingCount: 2,
      },
      setting: "home",
      horizonYears: 10,
      careDurationMonths: 36,
    },
  },
];

export function getPreset(id: string): Preset | undefined {
  return PRESETS.find((p) => p.id === id);
}
