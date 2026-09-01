"use client";

import { useRef, useState } from "react";
import type { CareProfile } from "@/lib/engine/match";

/**
 * 문서 판독. AI 필연성이 화면에서 가장 잘 보이는 지점이다.
 *
 * 판독에 실패해도 데모가 끊기지 않아야 한다.
 * 실패하면 조용히 넘어가지 말고 이유를 말한 뒤 직접 입력으로 유도한다.
 */
export function DocUpload({
  onExtracted,
}: {
  onExtracted: (profile: Partial<CareProfile>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<null | {
    docType: string;
    applied: string[];
    lowConfidence: { field: string; confidence: number }[];
    rejected: { field: string; reason: string }[];
    injections: string[];
    notes: string[];
  }>(null);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("docHint", "장기요양 등급판정 통지서 또는 진단서일 가능성이 높습니다");

      const res = await fetch("/api/extract", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "문서를 읽지 못했습니다.");

      const mapped = (json.mapped ?? {}) as Partial<CareProfile>;
      onExtracted(mapped);

      setResult({
        docType: json.extraction?.docType ?? "알 수 없음",
        applied: Object.keys(mapped),
        lowConfidence: json.lowConfidence ?? [],
        rejected: json.rejected ?? [],
        injections: json.guardrails?.injectionsBlocked ?? [],
        notes: json.extraction?.notes ?? [],
      });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "문서를 읽지 못했습니다.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div
        style={{
          display: "flex",
          gap: 10,
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <p className="eyebrow" style={{ margin: 0 }}>서류로 채우기 (선택)</p>
        <span className="badge badge-ai">AI 문서 판독</span>
      </div>

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) upload(f);
        }}
        style={{
          border: "1px dashed var(--line-strong)",
          borderRadius: 2,
          padding: "16px 18px",
          background: "var(--surface-sunk)",
          textAlign: "center",
        }}
      >
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--ink-2)" }}>
          장기요양 등급판정 통지서나 진단서를 올리면 아래 항목을 채웁니다.
        </p>
        <p style={{ margin: "4px 0 12px", fontSize: 12, color: "var(--ink-3)" }}>
          PNG · JPEG · WebP · PDF · 8MB 이하 · 저장하지 않습니다
        </p>
        <button
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          style={{
            border: "1px solid var(--line-strong)",
            background: "var(--surface)",
            borderRadius: 2,
            padding: "7px 15px",
            cursor: busy ? "wait" : "pointer",
            fontSize: 13.5,
          }}
        >
          {busy ? "읽는 중…" : "파일 선택"}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,application/pdf"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) upload(f);
          }}
        />
      </div>

      {err && (
        <p style={{ fontSize: 13, color: "var(--warn)", marginTop: 10, marginBottom: 0 }}>
          {err}
          <br />
          <span style={{ color: "var(--ink-3)" }}>아래에서 직접 입력하셔도 됩니다.</span>
        </p>
      )}

      {result && (
        <div
          className="card"
          style={{ marginTop: 10, padding: "12px 14px", background: "var(--accent-soft)" }}
        >
          <div style={{ fontSize: 13.5, fontWeight: 550, marginBottom: 6 }}>
            {result.docType} 으로 읽었습니다
          </div>

          {result.applied.length > 0 ? (
            <p style={{ margin: "0 0 6px", fontSize: 13 }}>
              반영한 항목: {result.applied.join(", ")}
            </p>
          ) : (
            <p style={{ margin: "0 0 6px", fontSize: 13, color: "var(--warn)" }}>
              확실하게 읽어낸 항목이 없습니다. 직접 입력해 주세요.
            </p>
          )}

          {result.lowConfidence.length > 0 && (
            <p style={{ margin: "0 0 4px", fontSize: 12.5, color: "var(--warn)" }}>
              확신이 낮아 반영하지 않음:{" "}
              {result.lowConfidence
                .map((l) => `${l.field} (${Math.round(l.confidence * 100)}%)`)
                .join(", ")}
            </p>
          )}
          {result.rejected.length > 0 && (
            <p style={{ margin: "0 0 4px", fontSize: 12.5, color: "var(--warn)" }}>
              형식이 맞지 않아 버림: {result.rejected.map((r) => r.field).join(", ")}
            </p>
          )}
          {result.injections.length > 0 && (
            <p style={{ margin: "0 0 4px", fontSize: 12.5, color: "var(--warn)", fontWeight: 550 }}>
              문서 안에서 지시문 {result.injections.length}건을 발견해 차단했습니다
            </p>
          )}
          {result.notes.map((n, i) => (
            <p key={i} style={{ margin: 0, fontSize: 12.5, color: "var(--ink-2)" }}>
              {n}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
