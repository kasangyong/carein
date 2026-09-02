"use client";

/**
 * 시그니처 — 버티는 기간 막대
 *
 * 이 화면에서 유일한 그림이다. 나머지는 전부 표로 간다.
 * 두 막대를 겹쳐 두는 이유: 제도를 찾으면 선이 오른쪽으로 밀리는 걸
 * 설명 없이 보여주기 위해서다.
 */
export function Gauge({
  horizonMonths,
  before,
  after,
  beforeLabel,
  afterLabel,
  flatReason,
}: {
  horizonMonths: number;
  before: number | null;
  after: number | null;
  beforeLabel: string;
  afterLabel: string;
  /** 두 막대가 같을 때 왜 같은지 — 사례마다 이유가 다르다 */
  flatReason?: string;
}) {
  const beforeMonths = before ?? horizonMonths;
  const afterMonths = after ?? horizonMonths;
  const gained = afterMonths - beforeMonths;

  const pct = (m: number) => Math.min(100, (m / horizonMonths) * 100);
  const years = Array.from({ length: Math.floor(horizonMonths / 12) + 1 }, (_, i) => i);

  return (
    <div>
      <Row
        caption="지금 그대로 두면"
        label={beforeLabel}
        widthPct={pct(beforeMonths)}
        years={years}
        horizonMonths={horizonMonths}
      />
      <div style={{ height: 10 }} />
      <Row
        caption="확인하고 신청하면"
        label={afterLabel}
        widthPct={pct(afterMonths)}
        years={years}
        horizonMonths={horizonMonths}
        isAfter
      />

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginTop: 12,
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <div className="num" style={{ fontSize: 11.5, color: "var(--ink-3)" }}>
          {years.map((y) => (
            <span key={y} style={{ marginRight: 10 }}>
              {y === 0 ? "지금" : `${y}년`}
            </span>
          ))}
        </div>
        {gained > 0 && (
          <div
            className="num"
            style={{ fontSize: 14, color: "var(--accent)", fontWeight: 600 }}
          >
            {Math.floor(gained / 12) > 0 ? `${Math.floor(gained / 12)}년 ` : ""}
            {gained % 12}개월 더 버틸 수 있습니다
          </div>
        )}
        {gained === 0 && (
          <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
            {flatReason ?? "이 사례에서는 늘어나는 기간이 없습니다"}
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  caption,
  label,
  widthPct,
  years,
  horizonMonths,
  isAfter,
}: {
  caption: string;
  label: string;
  widthPct: number;
  years: number[];
  horizonMonths: number;
  isAfter?: boolean;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
      <div
        className="eyebrow"
        style={{ width: 132, flexShrink: 0, textTransform: "none", letterSpacing: 0, fontSize: 12 }}
      >
        {caption}
      </div>
      <div className="gauge" style={{ flex: "1 1 260px", minWidth: 200 }}>
        {years.slice(1).map((y) => (
          <div
            key={y}
            className="gauge-tick"
            style={{ left: `${((y * 12) / horizonMonths) * 100}%` }}
          />
        ))}
        <div
          className={`gauge-fill${isAfter ? " is-after" : ""}`}
          style={{ width: `${widthPct}%`, animationDelay: isAfter ? "160ms" : "0ms" }}
        />
      </div>
      <div
        className="num"
        style={{
          width: 96,
          flexShrink: 0,
          textAlign: "right",
          fontSize: 16,
          fontWeight: 600,
          color: isAfter ? "var(--accent)" : "var(--ink)",
        }}
      >
        {label}
      </div>
    </div>
  );
}
