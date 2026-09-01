"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { money } from "@/lib/format";
import type { AnalyzeResult } from "@/lib/engine/analyze";

/**
 * 은행 앱 임베드용 축약 위젯.
 *
 * KB골든라이프·하나더넥스트·신한 SOL메이트 같은 시니어 탭에 iframe 으로 얹는 형태.
 * 은행 화면 안에 들어가므로 자체 헤더도 배경도 두지 않는다.
 *
 *   /widget?preset=hospital
 */
export default function Widget() {
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const preset = new URLSearchParams(window.location.search).get("preset") ?? "hospital";
    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ presetId: preset }),
    })
      .then((r) => r.json())
      .then((j) => (j.result ? setResult(j.result) : setErr(j.error ?? "불러오지 못했습니다.")))
      .catch(() => setErr("불러오지 못했습니다."));
  }, []);

  if (err) {
    return <p style={{ padding: 16, fontSize: 13, color: "var(--warn)" }}>{err}</p>;
  }
  if (!result) {
    return <p style={{ padding: 16, fontSize: 13, color: "var(--ink-3)" }}>계산 중…</p>;
  }

  const h = result.headline;

  return (
    <div style={{ padding: 16, background: "var(--surface)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <strong style={{ fontSize: 15 }}>돌봄 재무 점검</strong>
        <span className="eyebrow">carein</span>
      </div>

      <p style={{ margin: "8px 0 14px", fontSize: 13, color: "var(--ink-2)" }}>
        부모님 돌봄이 시작되면 앞으로 10년이 이렇게 달라집니다.
      </p>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 1,
          background: "var(--line)",
          border: "1px solid var(--line)",
        }}
      >
        <Mini label="지금 그대로" value={h.survivalWithoutPrograms} />
        <Mini label="확인하고 신청하면" value={h.survival} accent />
        <Mini label="놓치고 있던 제도" value={`${h.overlookedCount}개`} />
        <Mini label="월 실부담" value={money(h.monthlyBurden)} />
      </div>

      {h.monthsGainedByPrograms > 0 && (
        <p
          className="num"
          style={{ margin: "11px 0 0", fontSize: 13, color: "var(--accent)", fontWeight: 600 }}
        >
          {Math.floor(h.monthsGainedByPrograms / 12) > 0
            ? `${Math.floor(h.monthsGainedByPrograms / 12)}년 `
            : ""}
          {h.monthsGainedByPrograms % 12}개월 더 버틸 수 있습니다
        </p>
      )}

      <Link
        href="/"
        target="_top"
        style={{
          display: "block",
          marginTop: 14,
          textAlign: "center",
          border: "1px solid var(--primary)",
          background: "var(--primary)",
          color: "#fff",
          padding: "9px 14px",
          borderRadius: 2,
          textDecoration: "none",
          fontSize: 13.5,
        }}
      >
        내 상황으로 계산해 보기
      </Link>

      <p style={{ margin: "9px 0 0", fontSize: 11.5, color: "var(--ink-3)" }}>
        지급을 확정하지 않습니다. 건강·소득 정보를 저장하지 않습니다.
      </p>
    </div>
  );
}

function Mini({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div style={{ background: "var(--surface)", padding: "10px 12px" }}>
      <div className="eyebrow" style={{ marginBottom: 3, fontSize: 10.5 }}>{label}</div>
      <div
        className="num"
        style={{ fontSize: 16, fontWeight: 600, color: accent ? "var(--accent)" : "var(--ink)" }}
      >
        {value}
      </div>
    </div>
  );
}
